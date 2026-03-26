import React, { useState, useEffect, useMemo, useRef, Component, ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence, useSpring, useMotionValue } from "motion/react";
import { 
  Camera, 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  LayoutGrid, 
  Settings2, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  Key,
  Share2,
  X,
  Twitter,
  Facebook,
  Copy,
  Check,
  Languages,
  History,
  LogOut,
  LogIn,
  Trash2
} from "lucide-react";
import { Dish, PhotoStyle, ImageSize, CameraAngle } from './types';
import { translations, Language } from './i18n';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  User,
  OperationType,
  handleFirestoreError
} from './firebase';
import { deleteDoc, doc } from "firebase/firestore";

// Extend window interface for AI Studio API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Magnetic Button Component
const MagneticButton = ({ children, className, onClick, disabled }: { children: React.ReactNode, className?: string, onClick?: () => void, disabled?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { damping: 15, stiffness: 150 });
  const springY = useSpring(y, { damping: 15, stiffness: 150 });

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;
    x.set(distanceX * 0.35);
    y.set(distanceY * 0.35);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className="magnetic-wrap"
    >
      <button onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
    </motion.div>
  );
};

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const t = useMemo(() => translations[lang], [lang]);

  const [menuText, setMenuText] = useState('');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<PhotoStyle>('Bright/Modern');
  const [selectedAngle, setSelectedAngle] = useState<CameraAngle>('Standard');
  const [selectedSize, setSelectedSize] = useState<ImageSize>('1K');
  const [vibrantOverlay, setVibrantOverlay] = useState(false);
  const [vibrantIntensity, setVibrantIntensity] = useState(0.3);
  const [vibrantType, setVibrantType] = useState<'texture' | 'vintage'>('texture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [sharingDish, setSharingDish] = useState<Dish | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkApiKey();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'generations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(historyData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'generations');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const checkApiKey = async () => {
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    } catch (error) {
      console.error("Error checking API key:", error);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleSelectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success as per instructions
    } catch (error) {
      console.error("Error opening key selector:", error);
    }
  };

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const saveToHistory = async () => {
    if (!user || dishes.length === 0) return;
    
    setIsSaving(true);
    try {
      const generationData = {
        userId: user.uid,
        menuText,
        photoStyle: selectedStyle,
        cameraAngle: selectedAngle,
        imageSize: selectedSize,
        dishes: dishes.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          imageUrl: d.imageUrl || null
        })),
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'generations'), generationData);
      setIsSaving(false);
    } catch (error) {
      setIsSaving(false);
      handleFirestoreError(error, OperationType.CREATE, 'generations');
    }
  };

  const loadFromHistory = (gen: any) => {
    setMenuText(gen.menuText);
    setSelectedStyle(gen.photoStyle);
    setSelectedAngle(gen.cameraAngle || 'Standard');
    setSelectedSize(gen.imageSize);
    setDishes(gen.dishes);
    setShowHistory(false);
  };

  const deleteFromHistory = async (id: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await deleteDoc(doc(db, 'generations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `generations/${id}`);
    }
  };

  const parseMenu = async () => {
    if (!menuText.trim()) return;
    
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${t.extractPrompt} ${menuText}`,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsed = JSON.parse(response.text || '[]');
      const dishesWithIds = parsed.map((d: any, index: number) => ({
        ...d,
        id: `dish-${Date.now()}-${index}`
      }));

      setDishes(dishesWithIds);
    } catch (error) {
      console.error("Parsing error:", error);
      // Fallback to simple parsing if LLM fails
      const lines = menuText.split(/\n\n|\n(?=[•\-\d\.])|(?<=\.)\n/);
      const parsedDishes: Dish[] = lines
        .map((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          const parts = trimmed.split(/\n| - |: /);
          const name = parts[0].replace(/^[•\-\d\.\s]+/, '').trim();
          const description = parts.slice(1).join(' ').trim() || `A delicious ${name} prepared with fresh ingredients.`;
          return { id: `dish-${Date.now()}-${index}`, name, description };
        })
        .filter((d): d is Dish => d !== null && d.name.length > 2);
      setDishes(parsedDishes);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateImage = async (dish: Dish) => {
    if (!hasApiKey) {
      await handleSelectKey();
      return;
    }

    setDishes(prev => prev.map(d => 
      d.id === dish.id ? { ...d, isGenerating: true, error: undefined } : d
    ));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let stylePrompt = "";
      if (selectedStyle === 'Rustic/Dark') {
        stylePrompt = `
          Visual Profile: Moody, low-key lighting with dramatic rim lighting and deep shadows. 
          Camera Angle: 45-degree side angle to emphasize texture and depth.
          Background/Props: Reclaimed dark wood table, cast iron elements, heavy linen napkins. 
          Garnishing: Garnish with coarse sea salt, cracked black pepper, and fresh microgreens. 
          Atmosphere: High-end restaurant plating, 8k resolution, cinematic food photography, steam rising.`;
      } else if (selectedStyle === 'Bright/Modern') {
        stylePrompt = `
          Visual Profile: Professional magazine-quality look, subtle and diffused studio lighting, high-key and airy. 
          Camera Angle: Eye-level macro shot with a very shallow depth of field, focusing sharply on a single point of interest.
          Background/Props: White marble surface, clean ceramic plates, soft creamy bokeh background. 
          Garnishing: Minimalist garnish with a single edible flower or a delicate herb sprig. 
          Atmosphere: Fresh vibrant colors, professional studio food photography, clean and sophisticated presentation.`;
      } else if (selectedStyle === 'Social Media') {
        stylePrompt = `
          Visual Profile: Bright overhead lighting, vibrant and saturated colors. 
          Camera Angle: 90-degree flat lay (top-down view) for a trendy aesthetic.
          Background/Props: Scattered raw ingredients, artisanal cutlery, "lifestyle" messy aesthetic with a rustic touch. 
          Garnishing: Artistic drizzle of sauce, scattered spices, and vibrant herb toppings. 
          Atmosphere: Instagrammable food photography, high energy, appetizing and shareable look.`;
      } else if (selectedStyle === 'Vintage/Sepia') {
        stylePrompt = `
          Visual Profile: Soft, painterly effect with warm nostalgic sepia tones and a subtle vignette around the edges. 
          Camera Angle: Slightly high angle, reminiscent of a classic polaroid or vintage film camera.
          Background/Props: Aged parchment, antique silver cutlery, a worn leather-bound cookbook. 
          Garnishing: Dried herbs, a dusting of flour, or a single sprig of thyme. 
          Atmosphere: Timeless, rustic, and evocative of a cozy, old-world kitchen with a soft-focus dreamlike quality.`;
      } else if (selectedStyle === 'Minimalist/Monochrome') {
        stylePrompt = `
          Visual Profile: High contrast, stark black and white, emphasizing texture and form over color. 
          Camera Angle: Direct overhead or extreme side profile to highlight the dish's silhouette.
          Background/Props: Matte black or stark white ceramic, no distracting props, clean geometric lines. 
          Garnishing: A single, perfectly placed element like a drop of oil or a sharp herb leaf. 
          Atmosphere: Modern, sophisticated, and intensely focused on the essence of the food.`;
      } else if (selectedStyle === 'Vibrant/Foodie Blogger') {
        stylePrompt = `
          Visual Profile: Saturated, high energy, bright and punchy colors with a "pop" effect. 
          Camera Angle: Dynamic 3/4 view, close-up to show texture and "bite-ability".
          Background/Props: Colorful patterned napkins, trendy neon accents in the background, a hand holding a fork. 
          Garnishing: Generous toppings, colorful edible flowers, and a glossy sauce finish. 
          Atmosphere: Trendy, appetizing, and designed for maximum social media engagement.`;
      } else if (selectedStyle === 'Filmic/Cinematic') {
        stylePrompt = `
          Visual Profile: Dramatic, low-key lighting with deep shadows and rich, desaturated colors. 
          Camera Angle: Close-up, slightly Dutch angle to add tension.
          Background/Props: Dark slate surface or dimly lit kitchen, minimal props focusing on texture. 
          Garnishing: Subtle garnish, like a single herb or a dusting of spices. 
          Atmosphere: High-end, moody film scene, cinematic tension, 8k resolution.`;
      } else if (selectedStyle === 'Food Truck Street Food') {
        stylePrompt = `
          Visual Profile: High energy, natural daylight or harsh overhead street lighting, steam rising, slightly messy but appetizing.
          Camera Angle: Close-up, 3/4 view, handheld feel, slightly low angle to make the food look heroic.
          Background/Props: Metal counter, colorful food truck siding in the background, paper boat or wax paper, plastic fork.
          Garnishing: Generous toppings, colorful sauces, and a messy but enticing presentation.
          Atmosphere: Urban, fast-paced, authentic, vibrant colors.`;
      } else if (selectedStyle === 'Elegant Fine Dining') {
        stylePrompt = `
          Visual Profile: Sophisticated, soft directional lighting, high contrast with deep blacks and bright highlights.
          Camera Angle: Low angle or precise 45-degree angle, macro focus on intricate details.
          Background/Props: Fine white linen, silver cutlery, crystal glassware, dark slate or polished wood, artistic sauce smears.
          Garnishing: Artistic drizzle of sauce, perfectly placed microgreens, and a single edible flower.
          Atmosphere: Luxurious, quiet, exclusive, minimalist plating.`;
      } else if (selectedStyle === 'Cozy Cafe') {
        stylePrompt = `
          Visual Profile: Warm, soft, diffused morning light, golden hour glow, inviting and comfortable.
          Camera Angle: Eye-level or slightly high angle, including some of the surrounding environment (table edge, chair).
          Background/Props: Rustic wooden table, ceramic mug with latte art, a pair of glasses or a book, knitted napkin.
          Garnishing: Simple garnish, like a dusting of powdered sugar or a sprig of mint.
          Atmosphere: Relaxed, homely, comforting, soft focus background.`;
      }

      let cameraAnglePrompt = "";
      if (selectedAngle === 'Eye-level macro shot') {
        cameraAnglePrompt = "OVERRIDE Camera Angle: Eye-level macro shot with a very shallow depth of field, focusing sharply on a single point of interest.";
      } else if (selectedAngle === '45-degree side angle') {
        cameraAnglePrompt = "OVERRIDE Camera Angle: 45-degree side angle to emphasize texture and depth.";
      } else if (selectedAngle === 'Overhead flat lay') {
        cameraAnglePrompt = "OVERRIDE Camera Angle: 90-degree flat lay (top-down view) for a trendy aesthetic.";
      } else if (selectedAngle === 'Low angle') {
        cameraAnglePrompt = "OVERRIDE Camera Angle: Low angle, looking slightly up at the food to make it look heroic and grand.";
      }

      const prompt = `Professional high-end food photography of ${dish.name}: ${dish.description}. ${stylePrompt}. ${cameraAnglePrompt} The dish should look incredibly appetizing with realistic textures, visible moisture, and perfect plating.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: selectedSize
          }
        },
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageUrl) throw new Error("No image generated");

      setDishes(prev => prev.map(d => 
        d.id === dish.id ? { ...d, imageUrl, isGenerating: false } : d
      ));
    } catch (error: any) {
      console.error("Generation error:", error);
      let errorMessage = t.genError;
      
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        errorMessage = t.apiKeyError;
      }

      setDishes(prev => prev.map(d => 
        d.id === dish.id ? { ...d, isGenerating: false, error: errorMessage } : d
      ));
    }
  };

  const generateAll = async () => {
    for (const dish of dishes) {
      if (!dish.imageUrl && !dish.isGenerating) {
        await generateImage(dish);
      }
    }
  };

  const generateHeroPreview = async (dishName: string) => {
    const heroDish: Dish = {
      id: 'hero-preview',
      name: dishName,
      description: `A masterfully prepared ${dishName} featuring premium ingredients and exquisite presentation.`
    };
    setDishes([heroDish]);
    await generateImage(heroDish);
  };

  const handleShare = (dish: Dish) => {
    if (navigator.share && !dish.imageUrl?.startsWith('data:')) {
      navigator.share({
        title: `Check out this ${dish.name} from Gourmet Lens!`,
        text: dish.description,
        url: window.location.href,
      }).catch(console.error);
    } else {
      setSharingDish(dish);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = {
    twitter: (dish: Dish) => `https://twitter.com/intent/tweet?text=Check out this ${dish.name} generated by Gourmet Lens AI!&url=${encodeURIComponent(window.location.href)}`,
    facebook: (dish: Dish) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
  };

  // Custom Cursor Logic
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springConfig = { damping: 25, stiffness: 700 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);
  const dotXSpring = useSpring(cursorX, { damping: 40, stiffness: 1000 });
  const dotYSpring = useSpring(cursorY, { damping: 40, stiffness: 1000 });

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16);
      cursorY.set(e.clientY - 16);
    };
    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, []);

  if (isCheckingKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0D] noise-bg">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <Loader2 className="w-12 h-12 animate-spin text-[#FF7675]" />
          <div className="absolute inset-0 blur-3xl bg-[#FF7675]/20 animate-pulse" />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-[10px] uppercase tracking-[0.6em] text-white/40 font-black"
        >
          Initializing Gourmet Lens
        </motion.p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 relative overflow-hidden bg-[#0D0D0D] noise-bg cursor-none">
      {/* Custom Cursor */}
      <motion.div 
        className="custom-cursor hidden md:block"
        style={{ x: cursorXSpring, y: cursorYSpring }}
      />
      <motion.div 
        className="custom-cursor-dot hidden md:block"
        style={{ 
          x: dotXSpring, 
          y: dotYSpring 
        }}
      />
      {/* Faded Kitchen Background */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.18 }}
        transition={{ duration: 2 }}
        className="fixed inset-0 z-0 pointer-events-none"
      >
        <motion.img 
          style={{ y: 0 }}
          animate={{ scale: [1, 1.05, 1], y: [0, -20, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2000" 
          alt="Kitchen Background" 
          className="w-full h-[110%] object-cover filter grayscale brightness-90 contrast-125"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0D0D0D] via-transparent to-[#0D0D0D]" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#0D0D0D]/30 to-[#0D0D0D]" />
      </motion.div>

      {/* Background Accents - Atmospheric Glows */}
      <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-orange-500/[0.12] blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[1200px] h-[1200px] bg-red-500/[0.12] blur-[220px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-emerald-500/[0.08] blur-[150px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-blue-500/[0.06] blur-[130px] rounded-full pointer-events-none" />
      {/* Share Modal */}
      <AnimatePresence>
        {sharingDish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setSharingDish(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="luxury-card max-w-md w-full p-8 space-y-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif">{t.shareMasterpiece}</h3>
                <button onClick={() => setSharingDish(null)} className="opacity-40 hover:opacity-100 transition-opacity">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="aspect-square rounded-xl overflow-hidden border border-[#2a2a2a]">
                <img src={sharingDish.imageUrl} alt={sharingDish.name} className="w-full h-full object-cover" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <a
                  href={shareLinks.twitter(sharingDish)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors"
                >
                  <Twitter className="w-6 h-6 text-[#1DA1F2]" />
                  <span className="text-[10px] uppercase tracking-widest opacity-60">{t.twitter}</span>
                </a>
                <a
                  href={shareLinks.facebook(sharingDish)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors"
                >
                  <Facebook className="w-6 h-6 text-[#1877F2]" />
                  <span className="text-[10px] uppercase tracking-widest opacity-60">{t.facebook}</span>
                </a>
                <button
                  onClick={copyToClipboard}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors"
                >
                  {copied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6 opacity-60" />}
                  <span className="text-[10px] uppercase tracking-widest opacity-60">{copied ? t.copied : t.link}</span>
                </button>
              </div>

              <p className="text-[10px] text-center opacity-60 uppercase tracking-widest">
                {t.shareNote}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="px-6 py-16 md:px-24 md:py-32 relative z-10 flex flex-col lg:grid lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6 mb-12"
          >
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#FF7675] to-[#FF9F43] flex items-center justify-center shadow-2xl shadow-orange-500/20 relative group">
              <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Camera className="w-8 h-8 text-white relative z-10" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] uppercase tracking-[0.6em] font-black text-[#FF7675] leading-none">{t.title}</span>
              <span className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-mono font-bold">v2.5.0 • {lang === 'en' ? 'ULTRA-HD' : 'ULTRA-HD'}</span>
            </div>
          </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-8xl md:text-[12vw] font-display leading-[0.8] text-[#F5F5F5] uppercase tracking-tighter mb-8"
            >
              {lang === 'en' ? (
                <>Vibrant Food <br /><motion.span 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="text-[#FF7675] italic font-serif lowercase tracking-normal text-glow"
                >Artistry</motion.span></>
              ) : (
                <>Art Culinaire <br /><motion.span 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="text-[#FF7675] italic font-serif lowercase tracking-normal text-glow"
                >Vibrant</motion.span></>
              )}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-white/60 text-lg md:text-xl max-w-2xl font-medium leading-relaxed"
            >
              {lang === 'en' ? 'Transform your culinary descriptions into breathtaking, professional-grade visual masterpieces using state-of-the-art generative intelligence.' : 'Transformez vos descriptions culinaires en chefs-d\'œuvre visuels époustouflants de qualité professionnelle grâce à l\'intelligence générative de pointe.'}
            </motion.p>
          </div>

          <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between h-full py-4 gap-12">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
              <div className="flex items-center gap-3 p-2 rounded-[1.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl shadow-2xl">
                <button 
                  onClick={() => setLang('en')}
                  className={`px-6 py-3 rounded-xl text-[11px] uppercase tracking-widest font-black transition-all duration-700 ${lang === 'en' ? 'bg-[#FF7675] text-white shadow-xl shadow-orange-500/30' : 'text-white/20 hover:text-white/50'}`}
                >
                  English
                </button>
                <button 
                  onClick={() => setLang('fr')}
                  className={`px-4 py-3 rounded-xl text-[11px] uppercase tracking-widest font-black transition-all duration-700 ${lang === 'fr' ? 'bg-[#FF7675] text-white shadow-xl shadow-orange-500/30' : 'text-white/20 hover:text-white/50'}`}
                >
                  Français
                </button>
              </div>

              <div className="flex items-center gap-4">
                {user ? (
                  <>
                    <button 
                      onClick={() => setShowHistory(true)}
                      className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/40 hover:text-[#FF7675] hover:border-[#FF7675]/40 transition-all duration-500 group relative"
                    >
                      <History className="w-5 h-5" />
                      <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 text-[10px] uppercase tracking-widest text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
                        {t.history}
                      </span>
                    </button>
                    <button 
                      onClick={logOut}
                      className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] uppercase tracking-widest font-black text-white/40 hover:text-red-400 hover:border-red-400/40 transition-all duration-500"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline">{t.signOut}</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={signIn}
                    className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] uppercase tracking-widest font-black text-white/40 hover:text-[#FF7675] hover:border-[#FF7675]/40 transition-all duration-500"
                  >
                    <LogIn className="w-4 h-4" />
                    {t.signInWithGoogle}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end text-left lg:text-right space-y-6">
              <span className="text-[10px] uppercase tracking-[0.4em] font-black text-white/30">{t.samplePreviews}</span>
              <div className="flex flex-wrap lg:justify-end gap-6">
                {['Wagyu', 'Avocado', 'Truffle'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => generateHeroPreview(`Gourmet ${item}`)}
                    className="text-[12px] uppercase tracking-[0.2em] font-black text-white/40 hover:text-[#FF7675] transition-all duration-500 border-b-2 border-white/10 hover:border-[#FF7675] pb-2"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          {!hasApiKey && (
            <MagneticButton
              onClick={handleSelectKey}
              className="luxury-button w-full lg:w-auto"
            >
              <div className="flex items-center">
                <Key className="w-4 h-4 mr-3" />
                {t.connectApi}
              </div>
            </MagneticButton>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Controls Sidebar */}
          <aside className="lg:col-span-4 space-y-16 relative z-10 glass-panel p-12">
            <section className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.4em] text-[#FF7675] font-black">
                  <div className="w-12 h-12 rounded-2xl bg-[#FF7675]/10 flex items-center justify-center border border-[#FF7675]/20 shadow-inner">
                    <Upload className="w-6 h-6" />
                  </div>
                  {t.step1}
                </div>
                <span className="font-mono text-[10px] text-white/40 font-bold">01 / 03</span>
              </div>
              <textarea
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                placeholder={t.placeholder}
                className="w-full h-96 luxury-input resize-none text-base leading-relaxed"
              />
              <MagneticButton 
                onClick={parseMenu}
                disabled={!menuText.trim() || isProcessing}
                className="w-full luxury-button flex items-center justify-center gap-5 group"
              >
                <div className="flex items-center gap-5">
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 group-hover:rotate-45 transition-transform duration-500" />}
                  {t.extractDishes}
                </div>
              </MagneticButton>
            </section>

            <section className="space-y-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.4em] text-[#FF7675] font-black">
                  <div className="w-12 h-12 rounded-2xl bg-[#FF7675]/10 flex items-center justify-center border border-[#FF7675]/20 shadow-inner">
                    <Settings2 className="w-6 h-6" />
                  </div>
                  {t.step2}
                </div>
                <span className="font-mono text-[10px] text-white/40 font-bold">02 / 03</span>
              </div>
              
              <div className="space-y-8">
                <label className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 flex items-center gap-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF7675] shadow-[0_0_10px_rgba(255,118,117,0.5)]" />
                  {t.photoStyle}
                </label>
                <div className="grid grid-cols-1 gap-5">
                  {(['Rustic/Dark', 'Bright/Modern', 'Social Media', 'Vintage/Sepia', 'Minimalist/Monochrome', 'Vibrant/Foodie Blogger', 'Filmic/Cinematic', 'Food Truck Street Food', 'Elegant Fine Dining', 'Cozy Cafe'] as PhotoStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(style)}
                      className={`text-left px-8 py-7 rounded-[2rem] border transition-all duration-700 relative overflow-hidden group ${
                        selectedStyle === style 
                          ? 'bg-white/[0.08] border-[#FF7675]/60 text-[#FF7675] shadow-2xl shadow-orange-500/10' 
                          : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      {selectedStyle === style && (
                        <motion.div 
                          layoutId="active-style-bg"
                          className="absolute inset-0 bg-gradient-to-r from-[#FF7675]/10 to-transparent pointer-events-none"
                        />
                      )}
                      <div className="font-black text-[11px] mb-2 uppercase tracking-[0.2em] flex items-center justify-between">
                        {style}
                        {selectedStyle === style && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div className="text-[11px] opacity-50 leading-relaxed font-medium">
                        {style === 'Rustic/Dark' && t.styles.rustic}
                        {style === 'Bright/Modern' && t.styles.bright}
                        {style === 'Social Media' && t.styles.social}
                        {style === 'Vintage/Sepia' && t.styles.vintage}
                        {style === 'Minimalist/Monochrome' && t.styles.minimalist}
                        {style === 'Vibrant/Foodie Blogger' && t.styles.vibrant}
                        {style === 'Filmic/Cinematic' && t.styles.filmic}
                        {style === 'Food Truck Street Food' && t.styles.foodTruck}
                        {style === 'Elegant Fine Dining' && t.styles.fineDining}
                        {style === 'Cozy Cafe' && t.styles.cafe}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Vibrant Overlay Controls */}
                <AnimatePresence>
                  {selectedStyle === 'Vibrant/Foodie Blogger' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -10 }}
                      animate={{ height: 'auto', opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -10 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-6 mt-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-[0.2em] font-black text-white/60">{t.blogOverlay}</label>
                          <button 
                            onClick={() => setVibrantOverlay(!vibrantOverlay)}
                            className={`w-10 h-5 rounded-full relative transition-all duration-500 ${vibrantOverlay ? 'bg-[#FF7675]' : 'bg-white/10'}`}
                          >
                            <motion.div 
                              animate={{ x: vibrantOverlay ? 22 : 4 }}
                              className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm"
                            />
                          </button>
                        </div>

                        {vibrantOverlay && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                          >
                            <div className="flex gap-3">
                              {(['texture', 'vintage'] as const).map((type) => (
                                <button 
                                  key={type}
                                  onClick={() => setVibrantType(type)}
                                  className={`flex-1 py-3 rounded-xl text-[10px] uppercase tracking-widest font-black border transition-all duration-500 ${vibrantType === type ? 'bg-white/15 border-[#FF7675] text-[#FF7675]' : 'bg-transparent border-white/10 text-white/40 hover:text-white/60'}`}
                                >
                                  {type === 'texture' ? t.texture : t.vintageOverlay}
                                </button>
                              ))}
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-white/50">
                                <span>{t.intensity}</span>
                                <span className="font-mono">{Math.round(vibrantIntensity * 100)}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0.1" 
                                max="0.8" 
                                step="0.1" 
                                value={vibrantIntensity}
                                onChange={(e) => setVibrantIntensity(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#FF7675] hover:accent-[#FF9F43] transition-all"
                              />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                  <span className="w-1 h-1 rounded-full bg-[#FF7675]" />
                  {t.cameraAngle}
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {(['Standard', 'Eye-level macro shot', '45-degree side angle', 'Overhead flat lay', 'Low angle'] as CameraAngle[]).map((angle) => (
                    <button
                      key={angle}
                      onClick={() => setSelectedAngle(angle)}
                      className={`text-left px-6 py-4 rounded-2xl border transition-all duration-500 relative overflow-hidden group ${
                        selectedAngle === angle 
                          ? 'bg-white/[0.08] border-[#FF7675]/60 text-[#FF7675] shadow-lg shadow-orange-500/10' 
                          : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="font-black text-[10px] mb-1 uppercase tracking-[0.2em] flex items-center justify-between">
                        {angle}
                        {selectedAngle === angle && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <div className="text-[10px] opacity-50 leading-relaxed font-medium">
                        {angle === 'Standard' && t.angles.standard}
                        {angle === 'Eye-level macro shot' && t.angles.macro}
                        {angle === '45-degree side angle' && t.angles.side}
                        {angle === 'Overhead flat lay' && t.angles.overhead}
                        {angle === 'Low angle' && t.angles.low}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                  <span className="w-1 h-1 rounded-full bg-[#FF7675]" />
                  {t.imageResolution}
                </label>
                <div className="flex gap-4">
                  {(['1K', '2K', '4K'] as ImageSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`flex-1 py-4 rounded-2xl border text-[11px] uppercase tracking-[0.2em] font-black transition-all duration-500 ${
                        selectedSize === size
                          ? 'bg-[#FF7675] text-white border-[#FF7675] shadow-lg shadow-orange-500/20'
                          : 'bg-white/[0.03] border-white/10 text-white/40 hover:border-white/30'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {dishes.length > 0 && (
              <MagneticButton 
                onClick={generateAll}
                className="w-full luxury-button-outline flex items-center justify-center gap-4 group"
              >
                <div className="flex items-center gap-4">
                  <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {t.generateAll}
                </div>
              </MagneticButton>
            )}
          </aside>

          <div className="lg:col-span-8 relative z-10">
            <div className="flex items-center justify-between mb-16">
              <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.4em] text-[#FF7675] font-black">
                <div className="w-12 h-12 rounded-2xl bg-[#FF7675]/10 flex items-center justify-center border border-[#FF7675]/20 shadow-inner">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                {t.step3}
              </div>
              <div className="flex items-center gap-6">
                {user && dishes.length > 0 && (
                  <button 
                    onClick={saveToHistory}
                    disabled={isSaving}
                    className="flex items-center gap-3 px-6 py-3 rounded-full bg-[#FF7675]/10 border border-[#FF7675]/20 text-[10px] uppercase tracking-widest font-black text-[#FF7675] hover:bg-[#FF7675]/20 transition-all duration-500 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {isSaving ? t.saving : t.saveToHistory}
                  </button>
                )}
                <div className="font-mono text-[11px] text-white/50 bg-white/[0.04] px-6 py-3 rounded-full border border-white/10 font-bold">
                  {dishes.length} {t.dishes.toUpperCase()} <span className="mx-3 opacity-20">|</span> 03 / 03
                </div>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {dishes.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-[800px] border border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center text-center p-20 bg-white/[0.005] backdrop-blur-3xl relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FF7675]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="w-32 h-32 rounded-[3rem] bg-gradient-to-br from-[#FF7675]/10 to-[#FF9F43]/10 flex items-center justify-center mb-12 relative z-10 border border-white/10 shadow-2xl">
                    <ImageIcon className="w-12 h-12 text-[#FF7675]/60" />
                  </div>
                  <h3 className="text-4xl font-display uppercase tracking-[0.2em] mb-6 text-white relative z-10">{t.noDishes}</h3>
                  <p className="text-base text-white/50 max-w-md leading-relaxed font-medium relative z-10">
                    {t.noDishesDesc}
                  </p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {dishes.map((dish, index) => (
                    <motion.div
                      layout
                      key={dish.id}
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ 
                        duration: 0.8, 
                        delay: index % 2 * 0.1,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`luxury-card group ${
                        index % 5 === 0 ? 'md:col-span-2' : ''
                      }`}
                    >
                      <div className={`relative bg-[#0A0A0A] overflow-hidden ${
                        index % 5 === 0 ? 'aspect-[21/9]' : 'aspect-square'
                      }`}>
                        {dish.imageUrl ? (
                          <>
                            <img 
                              src={dish.imageUrl} 
                              alt={dish.name}
                              className="w-full h-full object-cover transition-transform duration-[3000ms] group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Vibrant Overlay Effect */}
                            {selectedStyle === 'Vibrant/Foodie Blogger' && vibrantOverlay && (
                              <div 
                                className="absolute inset-0 pointer-events-none mix-blend-overlay"
                                style={{ 
                                  opacity: vibrantIntensity,
                                  background: vibrantType === 'texture' 
                                    ? 'url("https://www.transparenttextures.com/patterns/natural-paper.png")'
                                    : 'linear-gradient(45deg, rgba(255,150,100,0.15), rgba(100,150,255,0.15))'
                                }}
                              />
                            )}
                            {selectedStyle === 'Vibrant/Foodie Blogger' && vibrantOverlay && vibrantType === 'vintage' && (
                              <div 
                                className="absolute inset-0 pointer-events-none mix-blend-soft-light"
                                style={{ 
                                  opacity: vibrantIntensity * 0.5,
                                  background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.4) 100%)'
                                }}
                              />
                            )}

                            <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-all duration-700 flex items-center justify-center gap-8 backdrop-blur-md">
                              {[
                                { icon: RefreshCw, action: () => generateImage(dish), label: 'Regenerate' },
                                { icon: Share2, action: () => handleShare(dish), label: 'Share' },
                                { icon: Download, action: null, label: 'Download', href: dish.imageUrl, download: `${dish.name.replace(/\s+/g, '_')}.png` }
                              ].map((btn, i) => (
                                <motion.div
                                  key={btn.label}
                                  initial={{ opacity: 0, y: 20 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.1, duration: 0.5 }}
                                >
                                  {btn.href ? (
                                    <a 
                                      href={btn.href} 
                                      download={btn.download}
                                      className="w-16 h-16 rounded-3xl bg-white/5 backdrop-blur-2xl hover:bg-[#FF7675] hover:text-white transition-all duration-500 flex flex-col items-center justify-center gap-2 text-white/40 group/icon"
                                    >
                                      <btn.icon className="w-6 h-6 group-hover/icon:scale-110 transition-transform" />
                                      <span className="text-[9px] uppercase tracking-[0.2em] font-black">{btn.label}</span>
                                    </a>
                                  ) : (
                                    <button 
                                      onClick={btn.action}
                                      className="w-16 h-16 rounded-3xl bg-white/5 backdrop-blur-2xl hover:bg-[#FF7675] hover:text-white transition-all duration-500 flex flex-col items-center justify-center gap-2 text-white/40 group/icon"
                                    >
                                      <btn.icon className="w-6 h-6 group-hover/icon:scale-110 transition-transform" />
                                      <span className="text-[9px] uppercase tracking-[0.2em] font-black">{btn.label}</span>
                                    </button>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-16 text-center">
                            {dish.isGenerating ? (
                              <div className="flex flex-col items-center gap-8">
                                <div className="relative">
                                  <Loader2 className="w-16 h-16 animate-spin text-[#FF7675]" />
                                  <div className="absolute inset-0 blur-2xl bg-[#FF7675]/30 animate-pulse" />
                                </div>
                                <p className="text-[11px] uppercase tracking-[0.5em] text-[#FF7675] font-black animate-pulse">{t.capturing}</p>
                              </div>
                            ) : dish.error ? (
                              <div className="flex flex-col items-center gap-8">
                                <AlertCircle className="w-16 h-16 text-red-500/10" />
                                <p className="text-[11px] text-red-500/40 uppercase tracking-[0.3em] font-black max-w-[200px] leading-relaxed">{dish.error}</p>
                                <button 
                                  onClick={() => generateImage(dish)}
                                  className="text-[11px] uppercase tracking-[0.4em] font-black text-white/20 hover:text-[#FF7675] transition-all duration-500 border-b border-white/5 hover:border-[#FF7675] pb-2"
                                >
                                  {t.tryAgain}
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => generateImage(dish)}
                                className="group/btn flex flex-col items-center"
                              >
                                <div className="w-24 h-24 rounded-[3rem] bg-white/[0.01] border border-white/[0.03] flex items-center justify-center mb-8 group-hover/btn:border-[#FF7675]/30 group-hover/btn:bg-[#FF7675]/5 transition-all duration-1000 group-hover/btn:scale-110 shadow-2xl">
                                  <Camera className="w-10 h-10 text-white/5 group-hover/btn:text-[#FF7675]/40 transition-colors" />
                                </div>
                                <span className="text-[11px] uppercase tracking-[0.5em] text-white/10 group-hover/btn:text-[#FF7675]/60 transition-colors font-black">{t.generate}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-12">
                        <div className="flex items-start justify-between gap-8 mb-6">
                          <h3 className="font-serif text-4xl text-[#F5F5F5] leading-tight tracking-tight">{dish.name}</h3>
                          {dish.imageUrl && (
                            <div className="w-8 h-8 rounded-full bg-emerald-500/5 flex items-center justify-center shrink-0 border border-emerald-500/10">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500/60" />
                            </div>
                          )}
                        </div>
                        <p className="text-base text-white/20 line-clamp-3 leading-relaxed font-medium">
                          {dish.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-6 mt-32 pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-white/20 text-[11px] uppercase tracking-[0.4em] font-bold">
        <div>{t.footerCopyright}</div>
        <div className="flex gap-12">
          <span className="hover:text-[#FF7675] transition-colors cursor-default">{t.footerPowered}</span>
          <span className="hover:text-[#FF7675] transition-colors cursor-default">{t.footerEngine}</span>
        </div>
      </footer>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0D0D0D] border-l border-white/5 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FF7675]/10 flex items-center justify-center border border-[#FF7675]/20">
                    <History className="w-5 h-5 text-[#FF7675]" />
                  </div>
                  <h2 className="text-xl font-display uppercase tracking-widest text-white">{t.history}</h2>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <History className="w-12 h-12" />
                    <p className="text-[11px] uppercase tracking-widest font-black">{t.noHistory}</p>
                  </div>
                ) : (
                  history.map((gen) => (
                    <div 
                      key={gen.id}
                      className="group p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#FF7675]/30 transition-all duration-500 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] text-white/30 font-mono font-bold">
                            {gen.createdAt?.toDate ? gen.createdAt.toDate().toLocaleString() : 'Recent'}
                          </p>
                          <h4 className="text-sm font-bold text-white/80 line-clamp-1 uppercase tracking-wider">
                            {gen.menuText.substring(0, 40)}...
                          </h4>
                        </div>
                        <button 
                          onClick={() => deleteFromHistory(gen.id)}
                          className="w-8 h-8 rounded-lg bg-red-500/5 flex items-center justify-center text-red-500/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {gen.dishes.slice(0, 4).map((dish: any, i: number) => (
                          <div key={i} className="w-12 h-12 rounded-lg bg-white/5 border border-white/5 overflow-hidden shrink-0">
                            {dish.imageUrl ? (
                              <img src={dish.imageUrl} alt="" className="w-full h-full object-cover opacity-60" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 opacity-20" />
                              </div>
                            )}
                          </div>
                        ))}
                        {gen.dishes.length > 4 && (
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/20 shrink-0">
                            +{gen.dishes.length - 4}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button 
                          onClick={() => loadFromHistory(gen)}
                          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-[#FF7675] text-white/40 hover:text-white text-[10px] uppercase tracking-widest font-black border border-white/5 hover:border-[#FF7675] transition-all duration-500"
                        >
                          {t.load}
                        </button>
                        <div className="px-3 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] text-white/20 font-mono font-bold uppercase tracking-tighter">
                          {gen.photoStyle.split('/')[0]}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppWithErrorBoundary() {
  return (
    <App />
  );
}
