export interface Extra {
  id: string;
  name: string;
  price: number;
}

export interface ExtraGroup {
  id: string;
  name: string;
  description: string | null;
  max_select: number;
  is_required: boolean;
  extras: { id: string; name: string; description: string | null; price: number; max_quantity: number }[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  badges?: string[];
  extras?: Extra[];
  extraGroups?: ExtraGroup[];
}

export const EXTRAS: Extra[] = [];
export const CATEGORIES: { id: string; name: string; icon: string }[] = [];
export const PRODUCTS: Product[] = [];
