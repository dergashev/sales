import {chromium} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// GIT-RECOVERY-01 path repair: the recovered historical script hard-coded an
// absolute machine path under the original author's home directory, which made
// the harness undurable outside one checkout. The artefact root is now derived
// from this file's own location. No board markup and no target pixels changed.
const artifactRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boardPath = path.join(artifactRoot, 'board/vo-t1-targets.html');
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.goto(pathToFileURL(boardPath).href, {waitUntil: 'networkidle'});
  await page.screenshot({path: path.join(artifactRoot, 'VO-T1-board-top.png')});
  await page.locator('#motion').scrollIntoViewIfNeeded();
  await page.screenshot({path: path.join(artifactRoot, 'VO-T1-board-motion.png')});

  const result = {
    title: await page.title(),
    targetCases: await page.locator('.case').count(),
    specificationPanels: await page.locator('.case details.spec').count(),
    currentFrames: await page.locator('img[alt^="Current "]').count(),
    target1440Frames: await page.locator('img[alt*="at 1440 by 900"]').count(),
    target1280Frames: await page.locator('img[alt*="at 1280 by 800"]').count(),
    motionStoryboards: await page.locator('.motion-card').count(),
    missingImages: await page.locator('img').evaluateAll(images => images
      .filter(image => !image.complete || image.naturalWidth === 0)
      .map(image => image.alt)),
    screenshots: ['VO-T1-board-top.png', 'VO-T1-board-motion.png'],
  };

  console.log(JSON.stringify(result, null, 2));
  const expectedSeventeen = [
    result.targetCases,
    result.specificationPanels,
    result.currentFrames,
    result.target1440Frames,
    result.target1280Frames,
  ].every(count => count === 17);
  if (!expectedSeventeen || result.motionStoryboards !== 8 || result.missingImages.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
