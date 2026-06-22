export const generateOrganizationCode = (organizationName) => {
  const words = organizationName.trim().split(/\s+/);

  let baseCode = "";

  if (words.length === 1) {
    baseCode = words[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 6)
      .toUpperCase();
  } else {
    baseCode = words
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  const uniqueIdentifier = Math.floor(1000 + Math.random() * 9000);

  return `${baseCode}${uniqueIdentifier}`;
};
