const fs = require('fs');
try {
    const content = fs.readFileSync('c:/repos/multiLLM/software/src/renderer/conversation-controller.js', 'utf8');
    // Wrap in a function to avoid executing global code immediately, 
    // but good enough to check parsing (mostly)
    // detailed syntax check:
    const vm = require('vm');
    const script = new vm.Script(content);
    console.log("Syntax OK");
} catch (e) {
    console.log("Syntax Error:");
    console.log(e.message);
    if (e.stack) console.log(e.stack);
}
