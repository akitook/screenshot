const puppeteer = require('puppeteer');
const fs = require('fs');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

(async () => {
  const browser = await puppeteer.launch();
  const urlList = fs.readFileSync('urlList.txt').toString().split("\n");
  await Promise.all(
    urlList.map(url => doScreenCapture(browser, url, false))
  )
  console.log('スクリーンショット完了しました。')
  browser.close();
})();

async function doScreenCapture(browser, url, isFull) {
  const page = await browser.newPage();
  page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 })
  await page.goto(url);
  await page.evaluate(_ => {
    window.scrollTo(0, 0);
  });
  if(isFull) {
    const lastPosition = await scrollPageToBottom(page, {
      size: 400,
      delay: 250,
      stepsLimit: 50
    })
  }
  
  const hostname = url.match(/^https?:\/{2,}(.*?)(?:\/|\?|#|$)/)[1];
  const imgName = hostname.replace(/\./g, "_");

  await page.screenshot({ path: `./images/${imgName}.jpg`, fullPage: isFull });
  console.log(`Done ${url}`)
  await page.close();
}