import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const input = {
  seq_wt: 'ACCTCTTATCTTCCTCCCACAGCTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCACTTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAAGCTCGCTTTCTTGCTGTCCAATTTCTATTAAAGGTTCCTTTGTTCCCTAAGTCCAACT',
  seq_RGEN: 'TCAGAAAGTGGTGGCTGGTG', seq_RGEN2: '', rgen_type: 0, end_range: 70,
  filt_n: 1, filt_r: 5, nucleases: '1', targetSeq: 'A', changeSeq: 'G', msgtype: 0, msgType: 0,
};
function run(sourceDirectory, sampleId) {
  let result, summary;
  const context = vm.createContext({
    console,
    FileReaderSync: class {
      readAsArrayBuffer(buffer) { return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); }
      readAsText(buffer) { return buffer.toString('utf8'); }
    },
    postMessage({ msgType, msg }) {
      if (msgType === 4) result = msg;
      else if (msgType === 0) summary = msg;
      else if (msgType !== 2) throw new Error(typeof msg === 'string' ? msg : msg.message);
    },
  });
  context.self = context;
  context.importScripts = () => vm.runInContext(readFileSync(`${sourceDirectory}/pako.js`, 'utf8'), context);
  vm.runInContext(readFileSync(`${sourceDirectory}/worker.js`, 'utf8'), context);
  const files = [1, 2].map(read => {
    const name = `Sample-ID-${sampleId}_S${sampleId}_L001_R${read}_001.fastq.gz`;
    const buffer = readFileSync(`public/samples/${name}`);
    return { name, size: buffer.length, slice: (start, end) => buffer.subarray(start, end) };
  });
  context.onmessage({ data: { ...input, files, fileId: `Sample-ID-${sampleId}_S${sampleId}` } });
  assert.ok(result, `Worker did not return sample ${sampleId}`);
  return { result: JSON.parse(JSON.stringify(result)), summary: JSON.parse(JSON.stringify(summary)) };
}
const report = { value: {}, format: input, summary: [] };
const expected = { 71: 'd63529ee4a41a6270827e7b08c03493674171e9b5ffc0d8c9fd99137efbe9d45', 72: '928804e7a558875a99b62c4bb6e76a8ccea8a0e42edc470740a52947fac300e9' };
for (const id of [71, 72]) {
  const current = run('public/engine', id);
  if (process.argv.includes('--compare-original')) {
    assert.deepEqual(current, run('../eun/public', id), `Original worker result differs for sample ${id}`);
  }
  const result = current.result;
  assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'), expected[id], `Golden output differs for sample ${id}`);
  report.value[result.fileId] = result;
  report.summary = current.summary;
  console.log(JSON.stringify({ sample: result.fileId, total: result.joins_length, indicators: result.totlr_count, retained: result.tot_count, insertions: result.cnt_ins, deletions: result.cnt_del, changed: result.changed, rows: result.table.length, sha256: createHash('sha256').update(JSON.stringify(result)).digest('hex') }));
}
if (process.argv.includes('--save-fixture')) writeFileSync('tests/fixtures/sample-report.json', JSON.stringify(report));
console.log('Original EUN sample analysis verified.');
