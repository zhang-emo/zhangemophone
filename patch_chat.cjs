const fs = require('fs');
let code = fs.readFileSync('src/components/ChatView.tsx', 'utf8');

code = code.replace(/if \(parsed\.realName\) uName = parsed\.realName;\s*else if \(parsed\.userId\) uName = parsed\.userId;/g, 
  "if (parsed.userId && parsed.userId !== 'User_Real') uName = parsed.userId;\n        else if (parsed.realName) uName = parsed.realName;");

fs.writeFileSync('src/components/ChatView.tsx', code);
