import { useDeferredValue, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, type Product, type Unit } from '../../store';
import { ConfirmDialog } from './ConfirmDialog';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { fetchSupabaseProductById, uploadSupabaseProductImage } from '../../lib/supabaseSync';
import { ExpandableDescription } from '../ui/ExpandableDescription';

type DraftRecipeLine = {
  inventoryItemId: string;
  amount: number;
  unit: Unit;
};

const UNIT_GROUP: Record<Unit, 'mass' | 'volume' | 'count'> = {
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  L: 'volume',
  pcs: 'count',
  units: 'count',
  bottles: 'count',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80';
const UNIT_OPTIONS: Unit[] = ['g', 'kg', 'ml', 'L', 'pcs', 'units', 'bottles'];

const buildProductId = (name: string) =>
  `u-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'product'}-${Math.random().toString(36).slice(2, 6)}`;

const normalizeImageUrl = (rawValue: string) => {
  const value = String(rawValue ?? '').trim();
  if (!value) return DEFAULT_IMAGE;
  if (value.startsWith('file://')) return null;
  if (/^[a-zA-Z]:\\/.test(value)) return null;
  if (value.startsWith('www.')) return `https://${value}`;
  return value;
};

export function ProductsView() {
  const products = useAppStore((state) => state.products);
  const inventory = useAppStore((state) => state.inventory);
  const productRecipes = useAppStore((state) => state.productRecipes);
  const getProductAvailability = useAppStore((state) => state.getProductAvailability);
  const upsertProductWithRecipe = useAppStore((state) => state.upsertProductWithRecipe);
  const deleteProductWithRecipe = useAppStore((state) => state.deleteProductWithRecipe);
  const setProductOutOfStock = useAppStore((state) => state.setProductOutOfStock);
  const userRole = useAppStore((state) => state.userRole);
  const isAdmin = userRole === 'admin';

  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [draft, setDraft] = useState<Product>({
    id: '',
    name: '',
    category: 'Beverage',
    price: 0,
    image: DEFAULT_IMAGE,
    barcode: '',
    description: '',
    ingredients: [],
    isManuallyOutOfStock: false,
    outOfStockNote: '',
  });
  const [draftRecipe, setDraftRecipe] = useState<DraftRecipeLine[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const getProductTitle = (item: any) => {
    const fromName = String(item?.name ?? '').trim();
    const fromTitle = String(item?.title ?? '').trim();
    const fromProductName = String(item?.product_name ?? '').trim();
    return fromName || fromTitle || fromProductName || 'Untitled item';
  };

  const inventoryById = useMemo(
    () => new Map(inventory.map((item) => [item.id, item])),
    [inventory]
  );

  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return products;

    return products.filter((item) => {
      const recipeNames = (productRecipes[item.id] ?? []).map((entry) => entry.inventoryName.toLowerCase());
      const fields = [
        item.id,
        item.name,
        item.category,
        item.barcode ?? '',
        item.description ?? '',
        ...(item.ingredients ?? []),
        ...recipeNames,
      ]
        .map((field) => String(field).toLowerCase());

      return fields.some((value) => value.includes(query));
    });
  }, [products, productRecipes, deferredSearchQuery]);

  const recipeValidation = useMemo(() => {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();

    draftRecipe.forEach((line, index) => {
      const row = index + 1;
      const inventoryItem = inventoryById.get(line.inventoryItemId);
      if (!inventoryItem) {
        blockingErrors.push(`Row ${row}: ingredient is not linked to a valid inventory item.`);
        return;
      }

      if (seen.has(line.inventoryItemId)) {
        blockingErrors.push(`Row ${row}: duplicate ingredient mapping for ${inventoryItem.name}.`);
      } else {
        seen.add(line.inventoryItemId);
      }

      if (Number(line.amount) <= 0) {
        blockingErrors.push(`Row ${row}: amount must be greater than zero for ${inventoryItem.name}.`);
      }

      if (UNIT_GROUP[line.unit] !== UNIT_GROUP[inventoryItem.unit]) {
        blockingErrors.push(
          `Row ${row}: unit ${line.unit} is incompatible with ${inventoryItem.name} stock unit ${inventoryItem.unit}.`
        );
      }
    });

    if (draftRecipe.length === 0) {
      blockingErrors.push('Map at least one ingredient before saving.');
    }

    if (draftRecipe.length > 8) {
      warnings.push('Large recipes are supported, but double-check each amount and unit before saving.');
    }

    return { blockingErrors, warnings };
  }, [draftRecipe, inventoryById]);

  const openCreate = () => {
    setEditingProductId(null);
    setDraft({
      id: '',
      name: '',
      category: 'Beverage',
      price: 0,
      image: DEFAULT_IMAGE,
      barcode: '',
      description: '',
      ingredients: [],
      isManuallyOutOfStock: false,
      outOfStockNote: '',
    });
    setDraftRecipe([]);
    setShowEditor(true);
  };

  const openEdit = (product: Product) => {
    setEditingProductId(product.id);
    setDraft({
      ...product,
      isManuallyOutOfStock: Boolean(product.isManuallyOutOfStock),
      outOfStockNote: product.outOfStockNote ?? '',
    });
    setDraftRecipe(
      (productRecipes[product.id] ?? [])
        .filter((entry) => Boolean(entry.inventoryItemId))
        .map((entry) => ({
          inventoryItemId: String(entry.inventoryItemId),
          amount: Number(entry.amount),
          unit: entry.unit,
        }))
    );
    setShowEditor(true);
  };

  const addRecipeLine = () => {
    const fallbackInventory = inventory[0];
    if (!fallbackInventory) {
      toast.error('No inventory items found. Add inventory first.');
      return;
    }
    setDraftRecipe((prev) => [
      ...prev,
      { inventoryItemId: fallbackInventory.id, amount: 1, unit: fallbackInventory.unit },
    ]);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      event.target.value = '';
      return;
    }

    try {
      setIsUploadingImage(true);
      const productHint = editingProductId ?? draft.name ?? 'product';
      const uploadedUrl = await uploadSupabaseProductImage(file, productHint);
      setDraft((prev) => ({ ...prev, image: uploadedUrl }));
      toast.success('Image uploaded to Supabase Storage.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image.';
      toast.error(message);
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  const saveDraft = () => {
    if (!draft.name.trim()) {
      toast.error('Product name is required.');
      return;
    }
    if (!draft.category.trim()) {
      toast.error('Category is required.');
      return;
    }
    if (Number(draft.price) <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }
    if (recipeValidation.blockingErrors.length > 0) {
      toast.error(recipeValidation.blockingErrors[0]);
      return;
    }

    const filteredRecipe = draftRecipe.filter(
      (line) => Boolean(inventoryById.get(line.inventoryItemId)) && Number(line.amount) > 0
    );
    if (filteredRecipe.length === 0) {
      toast.error('Mapped ingredients are invalid.');
      return;
    }

    const productId = editingProductId ?? buildProductId(draft.name);
    const normalizedImageUrl = normalizeImageUrl(draft.image ?? '');
    if (normalizedImageUrl === null) {
      toast.error('Local file paths are not supported in browser. Use https://... or /images/... from your project public folder.');
      return;
    }

    const nextProduct: Product = {
      ...draft,
      id: productId,
      name: draft.name.trim(),
      category: draft.category.trim(),
      image: normalizedImageUrl,
      barcode: (draft.barcode ?? '').trim(),
      description: draft.description?.trim() || '',
      price: Number(draft.price),
      isManuallyOutOfStock: Boolean(draft.isManuallyOutOfStock),
      outOfStockNote: draft.outOfStockNote?.trim() || '',
    };

    upsertProductWithRecipe({
      product: nextProduct,
      recipe: filteredRecipe,
    });

    void (async () => {
      try {
        // Allow async upsert/sync to settle before validating remote state.
        await new Promise((resolve) => setTimeout(resolve, 900));
        const remote = await fetchSupabaseProductById(nextProduct.id);
        if (!remote) return;

        const expectedImage = String(nextProduct.image ?? '').trim();
        const expectedDescription = String(nextProduct.description ?? '').trim();
        const remoteImage = String(remote.image ?? '').trim();
        const remoteDescription = String(remote.description ?? '').trim();

        if (remoteImage !== expectedImage || remoteDescription !== expectedDescription) {
          toast.warning('Saved locally, but Supabase returned different image/description. Please save again and check your SQL seed script.');
        }
      } catch {
        // Silent fallback: avoid blocking UX if verification endpoint is unavailable.
      }
    })();

    toast.success(editingProductId ? 'Product updated.' : 'Product created.');
    setShowEditor(false);
  };

  const handleDeleteProduct = (product: Product) => {
    if (!isAdmin) return;
    setPendingDelete(product);
  };

  return (
    <div className="w-full flex flex-col h-full pt-4">
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">Products</h2>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Product catalog with connected ingredients per item.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 bg-white/50 border border-[#D8C4AC]/30 rounded-full p-1 backdrop-blur-md">
            {(['cards', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                  viewMode === mode
                    ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-sm'
                    : 'text-[#4D0E13]/60 hover:text-[#4D0E13]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#4D0E13] text-[#F5EFE6] px-5 py-2.5 rounded-full hover:bg-[#3a0a0e] transition-all shadow-md active:scale-95 text-sm font-bold uppercase tracking-wide"
            >
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
        <Search size={16} className="text-[#4D0E13]/60" />
        <input
          type="text"
          placeholder="Search by name, barcode, category, or ingredient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[#4D0E13] placeholder-[#4D0E13]/40 outline-none"
        />
        <span className="text-[11px] font-bold text-[#4D0E13]/50 whitespace-nowrap">
          {filteredProducts.length} item(s)
        </span>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 pb-8">
          {filteredProducts.map((item, idx) => (
            (() => {
              const availability = getProductAvailability(item.id);
              const isOutOfStock = availability.isOutOfStock;
              const isManual = Boolean(item.isManuallyOutOfStock);

              return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.01, 0.08), duration: 0.16, ease: 'easeOut' }}
              className={`bg-white/65 backdrop-blur-xl border rounded-[1.5rem] p-6 shadow-[0_4px_24px_rgba(77,14,19,0.03)] flex min-h-[31rem] flex-col justify-between ${
                isOutOfStock ? 'border-red-200 bg-red-50/70' : 'border-white/70'
              }`}
            >
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="flex items-start justify-between gap-4 min-h-[4.75rem]">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-[1.35rem] leading-tight text-[#4D0E13] min-h-[2.8rem] line-clamp-2">
                      {getProductTitle(item)}
                    </h3>
                    {isOutOfStock && (
                      <p className="mt-1 text-[11px] font-semibold text-red-700">
                        {isManual ? 'Manually flagged out of stock' : 'Out of stock from inventory'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#D8C4AC]/25 text-[#4D0E13]/70 whitespace-nowrap">
                      {item.category}
                    </span>
                    {isOutOfStock && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full bg-red-600 text-white whitespace-nowrap">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-h-[4.8rem]">
                  <ExpandableDescription
                    id={item.id}
                    text={item.description}
                    fallback="No description."
                    clampLines={3}
                    wrapperClassName="mb-0"
                    className="min-h-[4.8rem]"
                    textClassName="text-sm text-[#4D0E13]/60"
                    buttonClassName="text-[#4D0E13]/60 hover:text-[#4D0E13]"
                    fadeClassName="bg-gradient-to-b from-transparent to-white/80"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45 mb-1.5">Mapped Ingredients</p>
                {item.ingredients && item.ingredients.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.ingredients.map((ingredient) => (
                      <span
                        key={`${item.id}-${ingredient}`}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#F5EFE6] border border-[#D8C4AC]/45 text-[#4D0E13]/75"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#4D0E13]/45">No linked ingredients listed.</p>
                )}
                </div>

                <div className="mt-auto pt-4 border-t border-[#D8C4AC]/30 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45">Product ID</span>
                    <p className="text-xs font-semibold text-[#4D0E13]/60 break-all">{item.id}</p>
                    <p className="text-[11px] font-semibold text-[#4D0E13]/50">Barcode: {item.barcode || 'N/A'}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap justify-end gap-2 shrink-0 max-w-[17rem]">
                      <button
                        onClick={() => setProductOutOfStock(item.id, !isManual, item.outOfStockNote ?? '')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                          isManual
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {isManual ? 'Clear OOS' : 'Flag OOS'}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="px-3 py-1.5 rounded-lg border border-[#D8C4AC]/50 bg-white/60 text-xs font-semibold text-[#4D0E13] hover:bg-white whitespace-nowrap"
                      >
                        Edit Map
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(item)}
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
              );
            })()
          ))}

          {filteredProducts.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 py-10 text-center text-sm font-medium text-[#4D0E13]/45">
              No products matched your search.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-[#D8C4AC]/35 bg-white/60 backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#F5EFE6]/70 text-[#4D0E13]/70 uppercase tracking-wider text-xs">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Barcode</th>
                <th className="text-left px-4 py-3">Ingredients</th>
                {isAdmin && <th className="text-left px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((item) => (
                <tr key={item.id} className="border-t border-[#D8C4AC]/25 text-[#4D0E13]">
                  <td className="px-4 py-3 font-semibold text-xs">{item.id}</td>
                  <td className="px-4 py-3 font-semibold">{getProductTitle(item)}</td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums font-semibold">₱{Number(item.price).toFixed(2)}</td>
                  <td className="px-4 py-3 font-semibold text-xs">{item.barcode || 'N/A'}</td>
                  <td className="px-4 py-3 text-[#4D0E13]/70">
                    {item.ingredients && item.ingredients.length > 0 ? item.ingredients.join(', ') : 'No linked ingredients'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="px-3 py-1.5 rounded-lg border border-[#D8C4AC]/50 bg-white/60 text-xs font-semibold text-[#4D0E13] hover:bg-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(item)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm font-medium text-[#4D0E13]/45">
                    No products matched your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="md:hidden mt-4 space-y-3">
          {filteredProducts.map((item) => (
            <div key={`mobile-${item.id}`} className="bg-white/65 backdrop-blur-xl border border-white/70 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg text-[#4D0E13] leading-tight">{getProductTitle(item)}</h3>
                  <p className="text-xs text-[#4D0E13]/60 mt-1 whitespace-nowrap">{item.category} • ₱{Number(item.price).toFixed(2)}</p>
                  <p className="text-[11px] text-[#4D0E13]/55">Barcode: {item.barcode || 'N/A'}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#D8C4AC]/25 text-[#4D0E13]/70">
                  {item.id}
                </span>
              </div>
              <p className="text-xs text-[#4D0E13]/55 mt-2">
                {item.ingredients && item.ingredients.length > 0 ? item.ingredients.join(', ') : 'No linked ingredients'}
              </p>
              {isAdmin && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openEdit(item)}
                    className="px-3 py-1.5 rounded-lg border border-[#D8C4AC]/50 bg-white/60 text-xs font-semibold text-[#4D0E13]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(item)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 py-8 text-center text-sm font-medium text-[#4D0E13]/45">
              No products matched your search.
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showEditor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowEditor(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] sm:w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white/90 backdrop-blur-2xl border border-white/70 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl z-50 p-4 sm:p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-2xl font-serif text-[#4D0E13]">{editingProductId ? 'Edit Product Mapping' : 'Add Product + Mapping'}</h3>
                <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-[#D8C4AC]/20 rounded-full transition-colors">
                  <X size={20} className="text-[#4D0E13]/60" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Product Name</label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Category</label>
                  <input
                    value={draft.category}
                    onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.price}
                    onChange={(e) => setDraft((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Image URL</label>
                  <input
                    value={draft.image}
                    onChange={(e) => setDraft((prev) => ({ ...prev, image: e.target.value }))}
                    placeholder="https://.../image.webp"
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                  />
                  <label className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    isUploadingImage
                      ? 'border-[#D8C4AC]/45 bg-[#F5EFE6] text-[#4D0E13]/60 cursor-not-allowed'
                      : 'border-[#D8C4AC]/55 bg-white/70 text-[#4D0E13] hover:bg-white'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                    />
                    {isUploadingImage ? 'Uploading...' : 'Upload to Supabase'}
                  </label>
                  <div className="mt-2 h-20 w-20 rounded-xl border border-[#D8C4AC]/45 bg-white/50 overflow-hidden">
                    <ImageWithFallback
                      src={(draft.image || DEFAULT_IMAGE).trim()}
                      alt={draft.name || 'Product preview'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Barcode</label>
                  <input
                    value={draft.barcode ?? ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, barcode: e.target.value }))}
                    placeholder="e.g. 291234567890"
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                  />
                </div>
                <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-[#D8C4AC]/45 bg-white/60 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.isManuallyOutOfStock)}
                    onChange={(e) => setDraft((prev) => ({ ...prev, isManuallyOutOfStock: e.target.checked }))}
                    className="h-4 w-4 rounded border-[#C8A49F] text-[#4D0E13]"
                  />
                  <span className="text-sm font-semibold text-[#4D0E13]">Manually flag this product as out of stock</span>
                </label>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Description</label>
                <textarea
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Out of Stock Note</label>
                <input
                  value={draft.outOfStockNote ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, outOfStockNote: e.target.value }))}
                  placeholder="Optional reason for the manual flag"
                  className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                />
              </div>

              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50">Ingredient Mapping</p>
                <button
                  onClick={addRecipeLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4D0E13] text-[#F5EFE6] text-xs font-semibold"
                >
                  <Plus size={14} /> Add Ingredient
                </button>
              </div>

              {(recipeValidation.blockingErrors.length > 0 || recipeValidation.warnings.length > 0) && (
                <div className="mb-3 rounded-xl border border-[#D8C4AC]/50 bg-[#FFF7ED]/70 px-3 py-2.5">
                  {recipeValidation.blockingErrors.map((message) => (
                    <p key={`err-${message}`} className="text-[11px] font-semibold text-[#9A3412]">• {message}</p>
                  ))}
                  {recipeValidation.warnings.map((message) => (
                    <p key={`warn-${message}`} className="text-[11px] font-semibold text-[#4D0E13]/70">• {message}</p>
                  ))}
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {draftRecipe.map((line, idx) => (
                  <div key={`${line.inventoryItemId}-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <select
                      value={line.inventoryItemId}
                      onChange={(e) =>
                        setDraftRecipe((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx
                              ? {
                                  ...entry,
                                  inventoryItemId: e.target.value,
                                  unit: inventoryById.get(e.target.value)?.unit ?? entry.unit,
                                }
                              : entry
                          )
                        )
                      }
                      className="sm:col-span-6 bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-3 py-2 text-[#4D0E13] text-sm"
                    >
                      {inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>{inv.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      onChange={(e) =>
                        setDraftRecipe((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, amount: Number(e.target.value) || 0 } : entry
                          )
                        )
                      }
                      className="sm:col-span-3 bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-3 py-2 text-[#4D0E13] text-sm"
                    />
                    <select
                      value={line.unit}
                      onChange={(e) =>
                        setDraftRecipe((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, unit: e.target.value as Unit } : entry
                          )
                        )
                      }
                      className="sm:col-span-2 bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-3 py-2 text-[#4D0E13] text-sm"
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDraftRecipe((prev) => prev.filter((_, entryIdx) => entryIdx !== idx))}
                      className="sm:col-span-1 p-2 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowEditor(false)}
                  className="flex-1 px-6 py-3 bg-white/60 text-[#4D0E13] border border-[#D8C4AC]/50 rounded-full font-bold hover:bg-white/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDraft}
                  className="flex-1 px-6 py-3 bg-[#4D0E13] text-[#EEE4DA] rounded-full font-bold hover:bg-[#3a0a0e] transition-all shadow-md"
                >
                  Save Product
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : 'Delete product?'}
        message="This will remove the product and its mapped ingredients."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteProductWithRecipe(pendingDelete.id);
          toast.success('Product removed.');
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
