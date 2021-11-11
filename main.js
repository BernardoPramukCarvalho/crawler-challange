
const Apify = require('apify');

const { utils: { enqueueLinks } } = Apify;

     
Apify.main(async () => {
 
    
//Creating and instance of Request queue to queue URLs to crawl
const requestQueue = await Apify.openRequestQueue();

//Create 'product-pages' Store or open it if it exists already
const store = await Apify.openKeyValueStore('product-pages');

//Adding Starting URLs 
await requestQueue.addRequest({url: 'https://www.edeka24.de'})
await requestQueue.addRequest({url: 'https://www.edeka24.de/Unsere-Themen-Welten/'})

//Initializing 'count' variable to allow for control of how many product pages were found
var count = 0;

//Initializing NewPages Around to store additional category pages 
var NewPages= []

const handlePageFunction = async({request, $}) => {

   //Options used for utils.enqueueLinks  
  const options = {
      $,
      requestQueue,
      pseudoUrls: ['https://www.edeka24.de[.*]'],
      baseUrl: request.loadedUrl,
      transformRequestFunction: req => {
            req.userData.productsPage = true;
          
        return req;
    }, 
  }  


  if(!request.userData.productsPage){ //if the url was not crawlled enqueue it
    await enqueueLinks(options) 
  }else{ //if it was, we start scrapping it

    //find products
    var productsFound = $(' .product-image a').map( function() {
        var urlSplitted = $(this).attr('href').split('/')
        var cut = urlSplitted.length > 3 ? urlSplitted.length -2 : 2
        var productCategory =  urlSplitted[cut]
        return {name: $(this).attr('title'), page: $(this).attr('href'), category: productCategory };
    }).get();
    if(productsFound.length){
        var productsSorted = {}

        //Get unique categories found
        var categories = [...new Map(productsFound.map(product => [product.category, product.category])).values()]

        for(cat of categories){
            //work only with products found for respective category
            var productsSorted = productsFound.filter(product => product.category === cat)
            //check if category is popupaleted in the store
            var doesExist = await store.getValue(cat)
            if(doesExist === null){ //if not just create a new entry directly from the products found store them and get additional category page number 
                count += productsSorted.length
                await store.setValue(cat,{products: productsSorted})
                await getPages(productsSorted)
            }else{//there is a category entry already so we merge both already found profucts and newly found ones and remove any repeated values
                var inicialAmount = doesExist.products.length
                //merging
                doesExist.products.push(...productsSorted)
                //removing repeated
                doesExist.products = [...new Map(doesExist.products.map(product => [product.name, product])).values()]
                var countOfAdded = doesExist.products.length  - inicialAmount
                count+=  countOfAdded
                //if new products where found
                //store them and get additional category page number 
                if(countOfAdded){
                   await store.setValue(cat,doesExist)
                   await getPages(productsSorted)
                }
            }   
        }
    }
  }
}

// since not all products are displayed in a category page and we cant click buttons 
// we need to create an url '[categoryUrl]/?pgNr=x' where x is the page number we want to load
async function getPages (productsSorted){
    //see  how many paged of the category we loaded already
    var pagesLoaded = NewPages.filter(page => page.category === cat)
    if(pagesLoaded.length){//if its not the first time we get this category we build an url with pgNr +1 and enqueue
        var lastPageLoaded =  pagesLoaded[pagesLoaded.length-1].url.split("?pgNr=")
        var newUrl = lastPageLoaded[0] + "?pgNr=" + ++lastPageLoaded[1]
        NewPages.push({category: cat, url:newUrl   })
        await requestQueue.addRequest({ url: newUrl, userData:{productsPage: true}})
    }else { //if it is the first time we get a category we remove de product part of the url and add "?pgNr=1" and enqueue
        var lastIndex=productsSorted[0].page.lastIndexOf("/");
        var newUrl = productsSorted[0].page.slice(0,lastIndex+1) + "?pgNr=1"
        NewPages.push({category: cat, url: newUrl  })
        await requestQueue.addRequest({ url: newUrl, userData:{productsPage :true}})
    }
}
//initialize crawler 
const crawler = new Apify.CheerioCrawler({
    requestQueue,
    handlePageFunction
   
});
//run crawler
await crawler.run()
console.log(`The number of pages added was ${count}`)

});















/*  const { startUrls } = await Apify.getInput();

    const requestList = await Apify.openRequestList('start-urls', startUrls);
    const requestQueue = await Apify.openRequestQueue();
    const proxyConfiguration = await Apify.createProxyConfiguration();

    const crawler = new Apify.CheerioCrawler({
        requestList,
        requestQueue,
        proxyConfiguration,
        // Be nice to the websites.
        // Remove to unleash full power.
        maxConcurrency: 50,
        handlePageFunction: async (context) => {
            const { url, userData: { label } } = context.request;
            log.info('Page opened.', { label, url });
            switch (label) {
                case 'LIST':
                    return handleList(context);
                case 'DETAIL':
                    return handleDetail(context);
                default:
                    return handleStart(context);
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.'); */