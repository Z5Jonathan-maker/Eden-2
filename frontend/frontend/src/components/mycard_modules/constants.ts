import { MyCardFormData } from "./types";
import { TEMPLATES } from "./TemplateThemes";

export const CARD_TEMPLATES = TEMPLATES;
export const TEMPLATE_FALLBACK = "/icons/tactical_card_header.png";

export const DEFAULT_FORM: MyCardFormData = {
  full_name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  bio: "",
  tagline: "",
  license_number: "",
};

export const TACTICAL_AVATAR = "/icons/tactical_avatar.png";
