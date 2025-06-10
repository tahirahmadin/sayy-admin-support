import axios from "axios";

const apiUrl = import.meta.env.DEV
  ? "/api" // Use proxy in development
  : "https://kifortestapi.gobbl.ai"; // Use direct URL in production

import CryptoJS from "crypto-js";

// Encryption function
export const getCipherText = (inputBodyData: any) => {
  let secretKey = import.meta.env.VITE_ENCRYPTION_KEY;

  const key = CryptoJS.enc.Utf8.parse(secretKey);

  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(inputBodyData), key, {
    mode: CryptoJS.mode.ECB,
  });

  const encryptedText = encrypted.toString();

  return { data: encryptedText };
};

// Get HMAC message
const getHmacMessageFromBody = (inputBodyData: string) => {
  const apiSecret = import.meta.env.VITE_HMAC_KEY;

  if (apiSecret) {
    const currentTimestamp = (Date.now() / 1000).toString();

    const hmacHash = CryptoJS.HmacSHA256(
      inputBodyData + currentTimestamp,
      apiSecret
    ).toString();

    return {
      hmacHash: hmacHash,
      currentTimestamp: currentTimestamp,
    };
  } else {
    return null;
  }
};

export async function getAdminSupportLogs() {
  try {
    let url = `${apiUrl}/admin/getSupportChatLogs`;
    console.log("Making API request to:", url);

    // HMAC Response
    let hmacResponse = getHmacMessageFromBody("");
    if (!hmacResponse) {
      console.error("HMAC authentication failed: VITE_HMAC_KEY is not set");
      return null;
    }
    console.log("HMAC authentication successful");

    let axiosHeaders = {
      HMAC: hmacResponse.hmacHash,
      Timestamp: hmacResponse.currentTimestamp,
    };
    console.log("Request headers:", axiosHeaders);

    let response = await axios
      .get(url, { headers: axiosHeaders })
      .then((res) => res.data);

    console.log("API Response:", response);

    if (response.error) {
      throw new Error(response.error);
    }
    return response.result;
  } catch (error) {
    console.error("Error fetching admin chat logs:", error);
    if (axios.isAxiosError(error)) {
      console.error("Axios error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
}

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

interface UpdateChatLogParams {
  newUserLog: Message[];
  clientId: string;
}

export async function updateAdminChatLog(params: UpdateChatLogParams) {
  try {
    const url = `${apiUrl}/admin/updateChatLog`;

    // Get encrypted data
    const encryptedData = getCipherText(params);

    // Get HMAC authentication
    let hmacResponse = getHmacMessageFromBody(JSON.stringify(encryptedData));
    if (!hmacResponse) {
      throw new Error("HMAC authentication failed: VITE_HMAC_KEY is not set");
    }

    const axiosHeaders = {
      HMAC: hmacResponse.hmacHash,
      Timestamp: hmacResponse.currentTimestamp,
    };

    const response = await axios.post(url, encryptedData, {
      headers: axiosHeaders,
      withCredentials: true,
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (error) {
    console.error("Error updating admin chat log:", error);
    throw error;
  }
}
