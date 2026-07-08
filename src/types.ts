export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'starters' | 'mains' | 'desserts' | 'drinks';
  image: string;
  tags?: string[];
  inStock: boolean;
  station: 'grill' | 'starters' | 'dessert' | 'bar';
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  station: 'grill' | 'starters' | 'dessert' | 'bar';
}

export interface BillRequest {
  requested: boolean;
  type?: 'single' | 'even' | 'itemized';
  numberOfPeople?: number;
  paidAmount?: number;
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  notes?: string;
  status: OrderStatus;
  total: number;
  paymentMethod: 'stripe' | 'counter';
  paymentStatus: 'unpaid' | 'paid';
  createdAt: string;
  acknowledgedByStaff?: boolean;
  billRequest?: BillRequest;
}

export interface UpsellRecommendation {
  recommendedItemId: string;
  pitch: string;
}

