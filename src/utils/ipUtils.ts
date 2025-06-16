// Function to get the client's IP address
export const getIpAddress = async (): Promise<string> => {
  try {
    // First try to get IP from a public IP service
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error fetching IP address:", error);
    // Fallback to localhost if we can't get the public IP
    return "127.0.0.1";
  }
};
