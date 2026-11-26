import { mountCourtPage } from "./common/2d/ashfall-duel/court-page.ts";
import { startAshfallDuel } from "./common/2d/ashfall-duel/ashfall-duel.ts";

// 不要用頂層 await：引擎把入口打包成 ES2020 腳本，建置會失敗。
mountCourtPage({ replace: document.querySelector("#game")! })
  .then((host) => startAshfallDuel(host))
  .catch((error) => console.error(error));
