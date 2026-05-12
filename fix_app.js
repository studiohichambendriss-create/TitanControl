const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Fix duplicate event
code = code.replace(/const event = recording\[playbackIndex\];\s+const event = recording\[playbackIndex\];/g, 'const event = recording[playbackIndex];');

// Fix IP dropdown logic
code = code.replace(/piIpInput\.value = localStorage\.getItem\('titan_pi_ip'\) \|\| '';/, "if (localStorage.getItem('titan_pi_ip')) piIpInput.value = localStorage.getItem('titan_pi_ip');");
code = code.replace(/const ip = piIpInput\.value\.trim\(\);/, "const ip = piIpInput.value;");

fs.writeFileSync('app.js', code);
