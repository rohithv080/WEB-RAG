import TurndownService from "turndown";
// @ts-ignore
import { tables } from "turndown-plugin-gfm";

const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
turndownService.use(tables);

const markdown = turndownService.turndown("<h1>Hello</h1><p>World</p><table><thead><tr><th>h1</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>");
console.log(markdown);
