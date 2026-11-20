import type { ItemField } from '@/lib/items';
import { getStock, money } from '@/lib/stock';
import { Notice } from '../../notice';
import { Shell } from '../../shell';
import { addItem, addItemCategory, completeItem, deleteItem, deleteItemCategory, setItemQuantity } from '../actions';

const PHOTO = 'image/jpeg,image/png,image/webp';

export default async function Items({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; cat?: string }> }) {
  const { error, message, cat } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const [{ data: categories, error: loadError }, { data: items }] = await Promise.all([
    stock.from('item_categories').select('id, name, website_key, fields').eq('company_id', org.id).order('created_at'),
    stock.from('items').select('id, name, category_id, selling_price, original_price, quantity, image_url').eq('company_id', org.id).order('created_at', { ascending: false }).limit(1000),
  ]);
  const current = categories?.find((c) => c.id === cat) ?? categories?.[0];
  const fields = (current?.fields ?? []) as ItemField[];
  const nameOf = new Map((categories ?? []).map((c) => [c.id, c.name]));
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Items</h1>
      <p>Anything you sell that is not a vehicle or a spare part. An item appears on your website by itself as soon as it has a photo and a selling price.</p>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />

      {current ? (
        <section className="tile">
          <h2>Add an item</h2>
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {categories!.map((c) => (
              <a key={c.id} href={`/stock/items?cat=${c.id}`} style={{ padding: '6px 14px', border: '1px solid currentColor', borderRadius: 6, fontWeight: c.id === current.id ? 700 : 400, textDecoration: 'none' }}>{c.name}</a>
            ))}
          </p>
          <form action={addItem} key={current.id}>
            <input type="hidden" name="category_id" value={current.id} />
            <div className="grid2">
              <label>Name<input name="name" required /></label>
              <label>Selling price<input name="selling_price" type="number" step="any" min="0" /></label>
              <label>Old price (crossed out)<input name="original_price" type="number" step="any" min="0" /></label>
              <label>In stock<input name="quantity" type="number" min="0" defaultValue="0" /></label>
              {fields.filter((f) => !f.long).map((f) => <label key={f.key}>{f.label}<input name={`f_${f.key}`} /></label>)}
              <label>Main photo (JPG, PNG or WebP, under 2 MB)<input name="photo" type="file" accept={PHOTO} /></label>
              <label>Photo 2<input name="photo2" type="file" accept={PHOTO} /></label>
              <label>Photo 3<input name="photo3" type="file" accept={PHOTO} /></label>
            </div>
            <label>Short description (shown on the website)<textarea name="description" rows={2} maxLength={255} /></label>
            {fields.filter((f) => f.long).map((f) => <label key={f.key}>{f.label}<textarea name={`f_${f.key}`} rows={4} /></label>)}
            <button type="submit">Add to {current.name}</button>
          </form>
        </section>
      ) : (
        <section className="tile">
          <h2>Start by making a category</h2>
          <p>Categories are yours: make one for each kind of thing you sell, and choose what extra details its items need.</p>
        </section>
      )}

      <section className="tile">
        <h2>{current ? 'Add another category' : 'New category'}</h2>
        <form action={addItemCategory}>
          <div className="grid2">
            <label>Name<input name="name" required placeholder="e.g. Shoes" /></label>
            <label>Website word (optional)<input name="website_key" placeholder="what your website filters on, e.g. shoes" /></label>
          </div>
          <label>Extra details its items need (one per line; add &quot;| long&quot; for a bigger box)<textarea name="fields" rows={5} placeholder={'Size\nColour\nMaterial\nCare instructions | long'} /></label>
          <button type="submit">Add category</button>
        </form>
        {current ? (
          <form action={deleteItemCategory} style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={current.id} />
            <button type="submit" className="secondary">Remove the category &quot;{current.name}&quot;</button>
          </form>
        ) : null}
      </section>

      <section className="tile">
        <h2>{items?.length ?? 0} items</h2>
        {items?.length ? (
          <table className="table">
            <thead><tr><th /><th>Item</th><th className="num">Price</th><th>In stock</th><th>Website</th><th /></tr></thead>
            <tbody>{items.map((i) => {
              const live = Boolean(i.image_url) && (i.selling_price ?? 0) > 0;
              return (
                <tr key={i.id}>
                  <td>{i.image_url ? <img src={i.image_url} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} /> : null}</td>
                  <td>{i.name} · {nameOf.get(i.category_id) ?? '—'}</td>
                  <td className="num">{money(i.selling_price)}{i.original_price ? <s style={{ opacity: 0.6, marginLeft: 6 }}>{money(i.original_price)}</s> : null}</td>
                  <td>
                    <form action={setItemQuantity} style={{ display: 'flex', gap: 6 }}>
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="cat" value={i.category_id} />
                      <input name="quantity" type="number" min="0" defaultValue={i.quantity} style={{ width: 80 }} />
                      <button type="submit" className="secondary">Save</button>
                    </form>
                  </td>
                  <td>
                    {live ? 'On the website' : (
                      <form action={completeItem} style={{ display: 'grid', gap: 4 }}>
                        <input type="hidden" name="id" value={i.id} />
                        <span>Not on the website yet: needs {[!i.image_url && 'a photo', !((i.selling_price ?? 0) > 0) && 'a selling price'].filter(Boolean).join(' and ')}</span>
                        {!((i.selling_price ?? 0) > 0) && <input name="selling_price" type="number" step="any" min="0" placeholder="Selling price" />}
                        {!i.image_url && <input name="photo" type="file" accept={PHOTO} />}
                        <button type="submit" className="secondary">Save</button>
                      </form>
                    )}
                  </td>
                  <td><form action={deleteItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="cat" value={i.category_id} /><button type="submit" className="secondary">Remove</button></form></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>No items yet.</p>}
      </section>
    </Shell>
  );
}
