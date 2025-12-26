import { encode } from '@toon-format/toon';

const css = { color: 'red', display: 'flex' };
const data = {
    n1: { style: css },
    n2: { style: css }, // Same reference
    n3: { style: { color: 'red', display: 'flex' } } // Same content, new object
};

console.log('--- Encoded Output ---');
console.log(encode(data));
console.log('----------------------');
