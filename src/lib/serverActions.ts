import axios from "axios";

const apiUrl = "https://kifortestapi.gobbl.ai";

export async function getAdminSupportLogs() {
  try {
    const response = await axios.get(`${apiUrl}/admin/getSupportChatLogs`);

    if (response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data.result;
  } catch (error) {
    console.error("Error fetching admin chat logs:", error);
    throw error;
  }
}

/**
 * Update (append) a new message to the admin/support chat log
 * @param {Object} params - { newUserLog: Message[], userId: string }
 */
export async function updateAdminChatLog(params: {
  newUserLog: any[];
  clientId: string;
}) {
  try {
    const response = await axios.post(`${apiUrl}/admin/updateChatLog`, params);
    return response.data;
  } catch (error) {
    console.error("Error updating admin chat log:", error);
    throw error;
  }
}
