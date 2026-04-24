import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, type Product, type Unit } from '../../store';

type DraftRecipeLine = {
  inventoryItemId: string;
  amount: number;
  unit: Unit;
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80';
const UNIT_OPTIONS: Unit[] = ['g', 'kg', 'ml', 'L', 'pcs', 'units', 'bottles'];

const buildProductId = (name: string) =>
  `u-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'product'}-${Math.random().toString(36).slice(2, 6)}`;

export function ProductsView() {
  const products = useAppStore((state) => state.products);
  const inventory = useAppStore((state) => state.inventory);
  const productRecipes = useAppStore((state) => state.productRecipes);
  const upsertProductWithRecipe = useAppStore((state) => state.upsertProductWithRecipe);
  const deleteProductWithRecipe = useAppStore((state) => state.deleteProductWithRecipe);
  const userRole = useAppStore((state) => state.userRole);
  const isAdmin = userRole === 'admin';

  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showEditor, setShowEditor] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Product>({
    id: '',
    name: '',
    category: 'Beverage',
    price: 0,
    image: DEFAULT_IMAGE,
    description: '',
    ingredients: [],
  });
  const [draftRecipe, setDraftRecipe] = useState<DraftRecipeLine[]>([]);

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

  const openCreate = () => {
    setEditingProductId(null);
    setDraft({
      id: '',
      name: '',
      category: 'Beverage',
      price: 0,
      image: DEFAULT_IMAGE,
      description: '',
      ingredients: [],
    });
    setDraftRecipe([]);
    setShowEditor(true);
  };

  const openEdit = (product: Product) => {
    setEditingProductId(product.id);
    setDraft({ ...product });
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
    if (!fallbackInventory) return;
    setDraftRecipe((prev) => [
      ...prev,
      { inventoryItemId: fallbackInventory.id, amount: 1, unit: fallbackInventory.unit },
    ]);
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
    if (draftRecipe.length === 0) {
      toast.error('Please map at least one ingredient.');
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
    const nextProduct: Product = {
      ...draft,
      id: productId,
      name: draft.name.trim(),
      category: draft.category.trim(),
      image: draft.image?.trim() || DEFAULT_IMAGE,
      description: draft.description?.trim() || '',
      price: Number(draft.price),
    };

    upsertProductWithRecipe({
      product: nextProduct,
      recipe: filteredRecipe,
    });

    toast.success(editingProductId ? 'Product updated.' : 'Product created.');
    setShowEditor(false);
  };

  const handleDeleteProduct = (product: Product) => {
    if (!isAdmin) return;
    const shouldDelete = window.confirm(`Delete product "${product.name}" and its mapped ingredients? This cannot be undone.`);
    if (!shouldDelete) return;
    deleteProductWithRecipe(product.id);
    toast.success('Product removed.');
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

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 pb-8">
          {products.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.2) }}
              className="bg-white/65 backdrop-blur-xl border border-white/70 rounded-[1.5rem] p-5 shadow-[0_4px_24px_rgba(77,14,19,0.03)]"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-serif text-xl text-[#4D0E13] leading-tight">{getProductTitle(item)}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#D8C4AC]/25 text-[#4D0E13]/70 whitespace-nowrap">
                  {item.category}
                </span>
              </div>

              <p className="text-sm text-[#4D0E13]/60 mb-3 min-h-[40px]">{item.description || 'No description.'}</p>

              <div className="mb-3">
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

              <div className="pt-3 border-t border-[#D8C4AC]/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45">Product ID</span>
                  <p className="text-xs font-semibold text-[#4D0E13]/60">{item.id}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="px-3 py-1.5 rounded-lg border border-[#D8C4AC]/50 bg-white/60 text-xs font-semibold text-[#4D0E13] hover:bg-white"
                    >
                      Edit Map
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(item)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
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
                <th className="text-left px-4 py-3">Ingredients</th>
                {isAdmin && <th className="text-left px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className="border-t border-[#D8C4AC]/25 text-[#4D0E13]">
                  <td className="px-4 py-3 font-semibold text-xs">{item.id}</td>
                  <td className="px-4 py-3 font-semibold">{getProductTitle(item)}</td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3">₱ {Number(item.price).toFixed(2)}</td>
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
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="md:hidden mt-4 space-y-3">
          {products.map((item) => (
            <div key={`mobile-${item.id}`} className="bg-white/65 backdrop-blur-xl border border-white/70 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg text-[#4D0E13] leading-tight">{getProductTitle(item)}</h3>
                  <p className="text-xs text-[#4D0E13]/60 mt-1">{item.category} • ₱ {Number(item.price).toFixed(2)}</p>
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
                    className="w-full bg-white/60 border border-[#D8C4AC]/50 rounded-xl px-4 py-3 text-[#4D0E13]"
                  />
                </div>
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

              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50">Ingredient Mapping</p>
                <button
                  onClick={addRecipeLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4D0E13] text-[#F5EFE6] text-xs font-semibold"
                >
                  <Plus size={14} /> Add Ingredient
                </button>
              </div>

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
    </div>
  );
}
