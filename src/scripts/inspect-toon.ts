import * as Toon from '@toon-format/toon';

console.log('Keys:', Object.keys(Toon));
console.log('Toon object:', Toon);

try {
    // @ts-ignore
    if (Toon.ToonSerializer) {
        // @ts-ignore
        console.log('ToonSerializer:', Toon.ToonSerializer);
    }
} catch (e) {
    console.error(e);
}
