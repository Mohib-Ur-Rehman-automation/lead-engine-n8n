// Runs the exact Code-node source the way n8n does: a function body with $input and $.
const fs = require('fs');
function run(file, items, nodes = {}) {
  const code = fs.readFileSync(__dirname + '/src/' + file, 'utf8');
  const $input = { all: () => items.map(j => ({ json: JSON.parse(JSON.stringify(j)) })) };
  const $ = name => ({
    all: () => (nodes[name] || []).map(j => ({ json: j })),
    itemMatching: i => ({ json: (nodes[name] || [])[i] }),
  });
  return new Function('$input', '$', code)($input, $).map(x => x.json);
}
module.exports = { run };
