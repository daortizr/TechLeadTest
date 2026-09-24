// Generates a 6-character reservation code without 0, O, 1, I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReservationCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return code;
}
