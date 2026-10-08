const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'..','server','cpanel-mcp.js'),'utf8');
const match=source.match(/function normalizeExcludePath\([\s\S]*?\n\}\nfunction mappingForLocal/);
if(!match) throw Error('exclude helper source not found');
const helperSource=match[0].replace(/\nfunction mappingForLocal[\s\S]*$/,'');
const excluded=vm.runInNewContext(`(() => { ${helperSource}; return excluded; })()`,{path});

const cases=[
  ['donatorske-znacke/public/uploads/test.png',['donatorske-znacke/public/uploads'],true],
  ['donatorske-znacke/public/uploads/sub/a.svg',['donatorske-znacke/public/uploads'],true],
  ['donatorske-znacke/data/certificates.json',['donatorske-znacke/data/certificates.json'],true],
  ['donatorske-znacke/data/certificates.json.bak',['donatorske-znacke/data/certificates.json'],false],
  ['donatorske-znacke/tmp/restart.txt',['donatorske-znacke/tmp/restart.txt'],true],
  ['donatorske-znacke/node_modules/pkg/a.js',['node_modules'],true],
  ['donatorske-znacke/public/uploads/test.png',['uploads'],true],
  ['donatorske-znacke/public/assets/test.png',['donatorske-znacke/public/uploads'],false],
  ['donatorske-znacke/data/archive.zip',[],true]
];

for(const [rel,excludes,expected] of cases){
  const actual=excluded(rel,excludes);
  if(actual!==expected) throw Error(`exclude mismatch for ${rel}: expected ${expected}, got ${actual}`);
}
console.log('Exclude path matching: PASS');
