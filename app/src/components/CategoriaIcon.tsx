// Ícono de categoría: círculo teñido con el color de la categoría y el glifo
// Lucide encima. Importa cada ícono por su ruta profunda para que Metro (que no
// hace tree-shaking) no meta los ~1.600 íconos de Lucide al bundle.
import type { LucideIcon } from 'lucide-react-native'
import Baby from 'lucide-react-native/icons/baby'
import Banknote from 'lucide-react-native/icons/banknote'
import Briefcase from 'lucide-react-native/icons/briefcase'
import Bus from 'lucide-react-native/icons/bus'
import Car from 'lucide-react-native/icons/car'
import Dumbbell from 'lucide-react-native/icons/dumbbell'
import Ellipsis from 'lucide-react-native/icons/ellipsis'
import Film from 'lucide-react-native/icons/film'
import Gift from 'lucide-react-native/icons/gift'
import GraduationCap from 'lucide-react-native/icons/graduation-cap'
import HandCoins from 'lucide-react-native/icons/hand-coins'
import HeartPulse from 'lucide-react-native/icons/heart-pulse'
import House from 'lucide-react-native/icons/house'
import PawPrint from 'lucide-react-native/icons/paw-print'
import PiggyBank from 'lucide-react-native/icons/piggy-bank'
import Plane from 'lucide-react-native/icons/plane'
import Receipt from 'lucide-react-native/icons/receipt'
import Shirt from 'lucide-react-native/icons/shirt'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import Smartphone from 'lucide-react-native/icons/smartphone'
import TrendingUp from 'lucide-react-native/icons/trending-up'
import Utensils from 'lucide-react-native/icons/utensils'
import Wrench from 'lucide-react-native/icons/wrench'
import Zap from 'lucide-react-native/icons/zap'
import { View } from 'react-native'
import {
  COLOR_CATEGORIA_FALLBACK,
  ICONO_CATEGORIA_FALLBACK,
  esIconoCategoria,
  type IconoCategoria,
} from '@vaulto/shared'

const GLIFOS: Record<IconoCategoria, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  house: House,
  zap: Zap,
  bus: Bus,
  car: Car,
  utensils: Utensils,
  'heart-pulse': HeartPulse,
  film: Film,
  'graduation-cap': GraduationCap,
  shirt: Shirt,
  smartphone: Smartphone,
  plane: Plane,
  'paw-print': PawPrint,
  dumbbell: Dumbbell,
  baby: Baby,
  wrench: Wrench,
  receipt: Receipt,
  gift: Gift,
  briefcase: Briefcase,
  'hand-coins': HandCoins,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  banknote: Banknote,
  ellipsis: Ellipsis,
}

export function CategoriaIcon({
  icono,
  color,
  size = 40,
}: {
  icono: string | null
  color: string | null
  size?: number
}) {
  const Glifo = GLIFOS[esIconoCategoria(icono) ? icono : ICONO_CATEGORIA_FALLBACK]
  const tinte = color ?? COLOR_CATEGORIA_FALLBACK
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        // 12 % de opacidad: fondo suave que deja al glifo cargar el contraste.
        backgroundColor: `${tinte}1F`,
      }}
    >
      <Glifo size={Math.round(size * 0.5)} color={tinte} strokeWidth={2} />
    </View>
  )
}
