const puppeteer = require('puppeteer');
const fs = require('fs');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

(async () => {
  const browser = await puppeteer.launch();
  const text = fs.readFileSync('urls.txt').toString().split("\n");
  await Promise.all(
    text.map(url => doScreenCapture(browser, url, false))
  )
  browser.close();
})();

async function doScreenCapture(browser, url, isFull) {
  const page = await browser.newPage();
  page.setViewport({ width: 1600, height: 900 })
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

  await page.screenshot({ path: `${imgName}.jpg`, fullPage: isFull });
  await page.close();
}