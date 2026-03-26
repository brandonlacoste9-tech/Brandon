export type PhotoStyle = 'Rustic/Dark' | 'Bright/Modern' | 'Social Media' | 'Vintage/Sepia' | 'Minimalist/Monochrome' | 'Vibrant/Foodie Blogger' | 'Filmic/Cinematic' | 'Food Truck Street Food' | 'Elegant Fine Dining' | 'Cozy Cafe';
export type CameraAngle = 'Standard' | 'Eye-level macro shot' | '45-degree side angle' | 'Overhead flat lay' | 'Low angle';
export type ImageSize = '1K' | '2K' | '4K';

export interface Dish {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isGenerating?: boolean;
  error?: string;
}
