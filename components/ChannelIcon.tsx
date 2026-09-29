import type { IconType } from "react-icons";
import { LuGlobe, LuInfo, LuMail, LuPhone } from "react-icons/lu";
import { SiFacebook, SiInstagram, SiLine, SiTiktok, SiX, SiYoutube } from "react-icons/si";
import { CHANNEL_TYPES, type ChannelType } from "@/lib/contact";

const ICONS: Record<ChannelType, IconType> = {
  line: SiLine,
  facebook: SiFacebook,
  phone: LuPhone,
  email: LuMail,
  instagram: SiInstagram,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  x: SiX,
  website: LuGlobe,
  other: LuInfo,
};

/** A channel's icon, white on a disc of its brand colour. */
export default function ChannelIcon({ type, size = 40 }: { type: ChannelType; size?: number }) {
  const Icon = ICONS[type];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full text-white ring-1 ring-white/10"
      style={{ width: size, height: size, background: CHANNEL_TYPES[type].color }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}
