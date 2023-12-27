export function extractHashValue(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return null // Return null for invalid or empty input
  }

  const hashIndex = url.indexOf('#')
  if (hashIndex === -1 || hashIndex === url.length - 1) {
    return null // Return null if there is no hash or it's the last character
  }

  return url.substring(hashIndex + 1)
}

export function appendRandomChars(inputStr) {
  const randomChars = generateRandomNumbers(4);
  return `${inputStr}-${randomChars}`;
}

function generateRandomNumbers(length) {
  const numericChars = '0123456789';
  let randomNumberString = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * numericChars.length);
    randomNumberString += numericChars.charAt(randomIndex);
  }
  return randomNumberString;
}
