import axios from 'axios';
import proxy from "../config/proxy";
const env = import.meta.env.MODE || 'local';
const host = proxy[env]?.host || proxy.local.host;

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
let isRefresh = false;
let success = false;
export async function tryRefreshToken(){
  if(isRefresh){
    while (isRefresh){
      await sleep(10)
    }
    return success;
  }
  isRefresh = true;
  try {
    // 尝试刷新 token
    let resp = await axios.get(host + "/as/accounts/refresh", {withCredentials: true});
    if (resp.status === 200 && resp.data.code === 200) {
      sessionStorage.setItem("token", resp.data.data)
      success = true;
    }else{
      sessionStorage.removeItem("token");
      success = false;
    }
  } catch (error) {
    sessionStorage.removeItem("token");
    success = false;
  }
  isRefresh = false;
  return success;
}
