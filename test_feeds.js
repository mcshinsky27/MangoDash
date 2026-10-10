// Test script to evaluate various sports RSS feeds for image availability
// This script is intended to be run with `node test_feeds.js` and will output
// a summary of each feed indicating how many items contain an image that the
// `newsvisual` widget can extract (using the same parser configuration as the
// widget).

const Parser = require('rss-parser');

// List of candidate sports RSS feeds (U.S. focused where possible)
const feeds = [
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/rss/' },
  // NPR Sports – provides media tags in many entries
  { name: 'NPR Sports', url: 'https://feeds.npr.org/1004/rss.xml' },
  // ESPN general news – may not have images, included for reference
  { name: 'ESPN News', url: 'https://www.espn.com/espn/rss/news' },
];

// Configure parser with the same custom fields used by the newsvisual widget
const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (MangoDash)' },
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumb'],
      ['enclosure', 'enc'],
      ['content:encoded', 'contentFull']
    ]
  }
});

// Helper to extract an image URL from an item using the widget's logic
function extractImg(item) {
  let img = '';
  if (item.enc && item.enc.url) img = item.enc.url;
  else if (item.media && item.media.$ && item.media.$.url) img = item.media.$.url;
  else if (item.thumb && item.thumb.$ && item.thumb.$.url) img = item.thumb.$.url;
  if (!img) {
    const m = (item.contentFull || item.content || '').match(/<img[^>]+src="([^"]+)"/);
    if (m) img = m[1];
  }
  return img;
}

(async () => {
  for (const f of feeds) {
    try {
      const feed = await parser.parseURL(f.url);
      const total = feed.items.length;
      const withImgCount = feed.items.filter(i => !!extractImg(i)).length;
      console.log(`=== ${f.name} ===`);
      console.log(`Feed title: ${feed.title}`);
      console.log(`Items: ${total}, items with image: ${withImgCount}`);
    } catch (e) {
      console.error(`Error fetching ${f.name}: ${e.message}`);
    }
  }
})();
