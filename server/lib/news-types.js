import { nanoid } from "nanoid";

export function newId() {
  return nanoid(12);
}

export function villageRoom(pincode, villageName) {
  return `village:${String(pincode)}:${String(villageName || "")
    .trim()
    .toLowerCase()}`;
}

export function dmRoom(a, b) {
  return `dm:${[a, b].sort().join(":")}`;
}

export function groupRoom(groupId) {
  return `group:${String(groupId)}`;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    displayName: user.displayName,
    email: user.email || "",
    pincode: user.pincode,
    state: user.state,
    district: user.district,
    postOffice: user.postOffice,
    villageName: user.villageName,
    lat: user.lat ?? null,
    lng: user.lng ?? null,
  };
}
