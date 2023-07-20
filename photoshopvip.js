const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

(async () => {
  const browser = await puppeteer.launch();
  const url = 'resource.html';
  await crollContents(browser, url)
  browser.close();
})();

async function crollContents(browser, url) {
  console.log('start: ' + url)
  const contentHtml = fs.readFileSync(url, 'utf8');
  const page = await browser.newPage();
  await page.setContent(contentHtml);

  console.log('crolling start.');
  // contents をクロール
  const titles = await page.$('p > a');
  let resultsArray = [];
let tokyoFlag = "";
for (let i = 0; i < resultSelectors.length; i++) {
    resultsArray.push(await (await resultSelectors[i].getProperty('textContent')).jsonValue())
    if(resultSelectors[i].match(/東京/)){
        tokyoFlag = i;
        break;
    }
}
  for(const title of titles) {
    const titleText = await (await title.getProperty('textCotnent')).jsonValue();
    const titleURL = await (await title.getProperty('href')).jsonValue();
    console.log({titleText, titleURL});

    // fs.writeFile(localfilefullpath, await viewSource.buffer(), (error) => {
    //   // エラー出たらエラーをログに出す
    //   if (error) {
    //     console.log(`error=${error}`);
    //     return;
    //   }
    //   // エラー出なかったらログに文字列を表示させる。
    //   console.log(`${imgName}_ogp.${fileType} を保存しました。`);
    // });
  }

   await page.close();
}