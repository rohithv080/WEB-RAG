import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-ignore
import { tables } from "turndown-plugin-gfm";
import { chunkDocument } from "../src/lib/scraper/chunk";

async function main() {
  const url = "https://101cookbooks.com/";
  console.log("Fetching", url);
  try {
    const res = await fetch(url);
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    
    const document = dom.window.document;
    const unwanted = ["script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "aside", "[role='navigation']", "[role='banner']", "[role='contentinfo']"];
    document.querySelectorAll(unwanted.join(", ")).forEach(el => el.remove());
    
    const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    turndownService.use(tables);
    const textContent = turndownService.turndown(document.body.innerHTML);
    
    console.log(`Page fetched. markdown length: ${textContent.length}`);
    const chunks = chunkDocument(textContent);
    console.log(`Chunks: ${chunks.length}`);
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Chunk ${i}:`);
      console.log(chunks[i].content.slice(0, 300));
      console.log('---');
    }
  } catch (e) {
    console.error(e);
  }
}

main();
