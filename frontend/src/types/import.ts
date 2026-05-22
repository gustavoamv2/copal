export type ImportNetwork = "Facebook" | "Instagram" | "LinkedIn" | "WhatsApp";
export type ImportMode = "draft" | "scheduled";

export interface RawPublication {
  id: string;
  titulo_interno: string;
  caption: string;
  hashtags?: string;
  caption_con_hashtags?: string;
  fecha_publicacion?: string;
  hora_publicacion?: string;
  fecha_hora_publicacion: string;
  redes?: string[];
  red_social?: string;
  canal_a_publicar?: string;   // formato alternativo: canal único como string
  tipo_publicacion?: string;
  imagen?: string;
  imagenes?: string[];  // múltiples imágenes para carruseles
  estado?: string;
  origen?: string;
  dia?: number;
  cta?: string;
  archivo_json_texto?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type ImportStatus = "pending" | "importing" | "imported" | "error" | "duplicate" | "skipped";

export interface ImportedPublication {
  raw: RawPublication;
  // editable fields
  title: string;
  caption: string;
  scheduledAt: string; // ISO datetime local string for input[datetime-local]
  networks: ImportNetwork[];
  instagramType: "feed" | "story" | "carousel" | "reel";
  imagePath: string;       // primary image path (first of imagePaths, for backward compat)
  imagePaths: string[];    // all image paths (carousel support)
  imageFile?: File;        // primary resolved file (for preview)
  imageFiles: File[];      // all resolved files
  imageUrl?: string;       // primary URL after upload
  // state
  validation: ValidationResult;
  importStatus: ImportStatus;
  importError?: string;
  isDuplicate: boolean;
  selected: boolean;
}

export interface ImportResult {
  id: string;
  title: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  duplicate?: boolean;
}

export interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
  missingImages: number;
  results: ImportResult[];
}
