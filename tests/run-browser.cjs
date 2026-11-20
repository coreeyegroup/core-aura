const {spawnSync}=require('node:child_process');
// Re-enable each workspace suite when its screen returns to the app.
const scripts=['staged-browser','packs-browser','admin-browser','android-download-browser','android-updater-browser'];
const failed=[];for(const script of scripts){console.log('Browser suite:',script);const r=spawnSync(process.execPath,['--require','./tests/dialogs.cjs','tests/'+script+'.cjs'],{stdio:'inherit',env:process.env,timeout:180000});if(r.status!==0)failed.push(script);}if(failed.length){console.error('Failed browser suites:',failed.join(', '));process.exit(1);}
