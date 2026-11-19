import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

// Delivery transformations (guide §4.4). fl_strip_profile removes EXIF/GPS metadata.
export const FEED_T = "c_limit,w_800,h_800,q_auto,f_auto,fl_strip_profile";
export const THUMB_T = "c_fill,g_auto,w_150,h_150,q_auto,f_auto,fl_strip_profile";

/** Each user may only upload into their own folder. */
export const userFolder = (userId: string) => `instacloud/${userId}`;

/** Create a short-lived signed payload so the browser uploads straight to Cloudinary. */
export function signUpload(userId: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = userFolder(userId);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.CLOUDINARY_API_SECRET);
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

/** Inject a transformation into a Cloudinary delivery URL. */
export function transformUrl(url: string, transformation: string) {
  return url.includes("/upload/") ? url.replace("/upload/", `/upload/${transformation}/`) : url;
}

export const isOwnCloudinaryUrl = (url: string) =>
  url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`);
