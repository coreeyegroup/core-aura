import {writeFile,readFile} from "node:fs/promises";
import {ambienceCatalog} from "../public/ambience.js";
const {version}=JSON.parse(await readFile("package.json","utf8"));
await writeFile("dist/nature-library.json",JSON.stringify({schemaVersion:1,version,source:"Original Core-aura procedural synthesis",recordings:false,frequencyMode:"Optional frequency-focus filter; exact tones are separate layers",sounds:Object.entries(ambienceCatalog).map(([id,s])=>({id,name:s.name,family:s.family,description:s.detail,sourceType:"generated",filterHz:{min:80,max:8000},intensity:true}))},null,2)+"\n");
console.log(`Prepared original nature catalogue: ${Object.keys(ambienceCatalog).length} generated textures`);
