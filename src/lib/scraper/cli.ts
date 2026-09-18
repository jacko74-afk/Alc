import { runScrape } from "./run";

runScrape((line) => console.log(line)).catch((error) => {
  console.error(error);
  process.exit(1);
});
