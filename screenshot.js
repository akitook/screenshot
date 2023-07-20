const puppeteer = require('puppeteer');
const fs = require('fs');

const path = require('path');
const GIFEncoder = require('gifencoder');
const pngFileStream = require('png-file-stream');

const { scrollPageToBottom } = require('puppeteer-autoscroll-down');
const ms = process.argv[2] || 1000;
const isFull = process.argv[3] || true;
const isOgp = process.argv[4] || true;

const { ImagePool } = require('@squoosh/lib');
const { cpus } = require("os");
const imagePool = new ImagePool(cpus().length);

(async () => {
  const browser = await puppeteer.launch();
  const text = fs.readFileSync('urls.txt').toString().split("\n");
  await Promise.all(
    text.map(url => doScreenCapture(browser, url))
  )
  browser.close();
})();

const waitTillHTMLRendered = async (page, timeout) => {
  console.log(timeout);
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while(checkCounts++ <= maxChecks){
    let html = await page.content();
    let currentHTMLSize = html.length; 

    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

    if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
      countStableSizeIterations++;
    else 
      countStableSizeIterations = 0; //reset the counter

    if(countStableSizeIterations >= minStableSizeIterations) {
      console.log("Page rendered fully..");
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }  
};

async function doScreenCapture(browser, url) {
  console.log('start: ' + url)

  const option = {
    'waitUntil':'load'
  }
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0); 
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 2})
  await page.goto(url, option)
  await waitTillHTMLRendered(page, ms)
  await page.addStyleTag({path: 'inject.css'})
  await page.evaluate(_ => {
    window.scrollTo(0, 0);
  });

 
  // スクリーンショット
  const hostname = url.match(/^https?:\/{2,}(.*?)(?:\/|\?|#|$)/)[1];
  const imgName = hostname.replace(/\./g, "_");
  const dirname = `result/${imgName}`
  fs.access(dirname, fs.constants.R_OK | fs.constants.W_OK, (error) => {
    if (error) {
      if (error.code === "ENOENT") {
        fs.mkdirSync(dirname);
      }
    }
  });

  await page.screenshot({ path: `result/${imgName}/fv.jpg`, fullPage: false });

  if(isFull) {
    const lastPosition = await scrollPageToBottom(page, {
      size: 400,
      delay: 250,
      stepsLimit: 50
    })
  }
  await page.screenshot({ path: `result/${imgName}/pc.jpg`, fullPage: isFull });
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 })
  await page.screenshot({ path: `result/${imgName}/sp.jpg`, fullPage: isFull });

  // meta
  const metaTitle = await page.title();
  const titleText = await metaTitle ? metaTitle : '';
  const description = await page.$('meta[name="description"]');
  const descriptionContent = await description.getProperty('content');
  const descriptionText = descriptionContent ? await descriptionContent.jsonValue() : '';
  // const h1 = await page.$('h1');
  // const h1Content= await h1.getProperty('textContent');
  // const h1Text = h1Content ? await h1Content.jsonValue() : '';


  const csv = `
  ${url},${titleText},${descriptionText}`
  console.log(csv)

  fs.appendFile(`result/list.csv`, csv, (err) => console.log(err))


   // ogp image
   if(isOgp) {
    const ogp = await page.$('meta[property="og:image"]');
    if(!ogp) {
      console.log(`${imgName}のogpはありません`)
    } else {
      const ogpContent = await ogp.getProperty('content');
      if(ogpContent) {
        const targetUrl = await (ogpContent).jsonValue();
        const fileType = targetUrl.split('.').pop();
        const localfilefullpath = path.join(__dirname, `result/${imgName}/ogp.${fileType}`);
        const viewSource = await page.goto(targetUrl);
        fs.writeFile(localfilefullpath, await viewSource.buffer(), (error) => {
          // エラー出たらエラーをログに出す
          if (error) {
            console.log(`error=${error}`);
            return;
          }
          // エラー出なかったらログに文字列を表示させる。
          console.log(`${imgName}_ogp.${fileType} を保存しました。`);
        });
      }
    }
  }
    
   await page.close();

  // squooshによる画像の圧縮

  /**
   * 画像フォルダのパス。今回はこのフォルダ内の画像を対象とする
   */

  // 画像ディレクトリ内のJPGとPNGを抽出
  const directoryPath = path.join(__dirname, `result/${imgName}`);
  const imageFileList = fs.readdirSync(directoryPath).filter((file) => {
    const regex = /\.(jpe?g|png)$/i;
    return regex.test(file);
  });

  // 抽出したファイルをimagePool内にセットし、ファイル名とimagePoolの配列を作成
  const imagePoolList = imageFileList.map((fileName) => {
    const imageFile = fs.readFileSync(`${directoryPath}/${fileName}`);
    const image = imagePool.ingestImage(imageFile);
    return { name: fileName, image };
  });

  // JPEGの圧縮オプション
  const jpgEncodeOptions = {
    mozjpeg: { quality: 75 },
  };

  // PNGの圧縮オプション
  const pngEncodeOptions = {
    oxipng: {
      effort: 2,
    },
  };

  // JPEGならMozJPEGに、PNGならOxipngに圧縮する
  await Promise.all(
    imagePoolList.map(async (item) => {
      const { image } = item;
      if (/\.(jpe?g)$/i.test(item.name)) {
        await image.encode(jpgEncodeOptions);
      }
      if (/\.(png)$/i.test(item.name)) {
        await image.encode(pngEncodeOptions);
      }
    })
  );

  /**
   * 出力先フォルダ
   */

  // 圧縮したデータを出力する
  for (const item of imagePoolList) {
    const {
      name,
      image: { encodedWith },
    } = item;

    // 圧縮したデータを格納する変数
    let data;

    // JPGならMozJPEGで圧縮したデータを取得
    if (encodedWith.mozjpeg) {
      data = await encodedWith.mozjpeg;
    }
    // PNGならOxiPNGで圧縮したデータを取得
    if (encodedWith.oxipng) {
      data = await encodedWith.oxipng;
    }
    // 出力先フォルダがなければ作成
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath);
    }
    // ファイルを書き込む
    await fs.writeFile(`${directoryPath}/optimized_${name}`, data.binary, (error) => {
      // エラー出たらエラーをログに出す
      if (error) {
        console.log(`error=${error}`);
        return;
      }
      // エラー出なかったらログに文字列を表示させる。
      console.log(`optimized_${name} を保存しました。`);
    });
  }

  // imagePoolを閉じる
  await imagePool.close();  

}