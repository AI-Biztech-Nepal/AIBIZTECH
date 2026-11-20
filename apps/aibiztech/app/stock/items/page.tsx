import { getStock, money } from '@/lib/stock';
import { Notice } from '../../notice';
import { Shell } from '../../shell';
import { addItem, completeItem, deleteItem, setItemQuantity } from '../actions';

// What each website category asks for. The same few columns are reused with the labels that suit the kind of item.
const KINDS = {
  luggage: { label: 'Luggage', type: ['Type', 'Full Set'], size: ['Sizes', '20-inch / 24-inch / 28-inch'], brand: 'Crocodile', color: 'Pink', warranty: '3 Year International Warranty', features: 'Anti-Theft Zipper, 360° Spinner Wheels, Aluminum Handle' },
  kitchen: { label: 'Kitchen', type: ['Type', 'Cookware set'], size: ['Size / capacity', '3 litre'], brand: 'Prestige', color: 'Silver', warranty: '1 Year Warranty', features: 'Material, what is in the box, how to clean' },
  appliances: { label: 'Home Appliances', type: ['Type', 'Air fryer'], size: ['Capacity / power', '4.5 litre, 1500 W'], brand: 'Philips', color: 'Black', warranty: '1 Year Warranty', features: 'Power, controls, safety features' },
} as const;
type Kind = keyof typeof KINDS;

export default async function Items({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; cat?: string }> }) {
  const { error, message, cat } = await searchParams;
  const kind: Kind = cat === 'kitchen' || cat === 'appliances' ? cat : 'luggage';
  const k = KINDS[kind];
  const { stock, ctx, org, setupError } = await getStock();
  const { data: items, error: loadError } = await stock.from('items').select('id, name, category, selling_price, original_price, quantity, image_url, website_category').eq('company_id', org.id).order('created_at', { ascending: false }).limit(1000);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Items</h1>
      <p>Anything you sell that is not a vehicle or a spare part. An item appears on your website by itself as soon as it has a photo, a selling price and a category.</p>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <section className="tile">
        <h2>Add an item</h2>
        <p style={{ display: 'flex', gap: 8 }}>
          {(Object.keys(KINDS) as Kind[]).map((key) => (
            <a key={key} href={`/stock/items?cat=${key}`} className={key === kind ? undefined : 'secondary'} style={{ padding: '6px 14px', border: '1px solid currentColor', borderRadius: 6, fontWeight: key === kind ? 700 : 400, textDecoration: 'none' }}>{KINDS[key].label}</a>
          ))}
        </p>
        <form action={addItem} key={kind}>
          <input type="hidden" name="website_category" value={kind} />
          <div className="grid2">
            <label>Name<input name="name" required /></label>
            <label>Selling price<input name="selling_price" type="number" step="any" min="0" /></label>
            <label>Old price (crossed out)<input name="original_price" type="number" step="any" min="0" /></label>
            <label>In stock<input name="quantity" type="number" min="0" defaultValue="0" /></label>
            <label>Brand<input name="brand" placeholder={k.brand} /></label>
            <label>{k.type[0]}<input name="item_type" placeholder={k.type[1]} /></label>
            <label>Colour<input name="color" placeholder={k.color} /></label>
            <label>{k.size[0]}<input name="sizes" placeholder={k.size[1]} /></label>
            <label>Warranty<input name="warranty" placeholder={k.warranty} /></label>
            <label>Main photo (JPG, PNG or WebP, under 2 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
            <label>Photo 2<input name="photo2" type="file" accept="image/jpeg,image/png,image/webp" /></label>
            <label>Photo 3<input name="photo3" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          </div>
          <label>Short description (shown on the website)<textarea name="description" rows={2} maxLength={255} /></label>
          <label>Key features (one per line)<textarea name="features" rows={4} placeholder={k.features} /></label>
          <button type="submit">Add {k.label.toLowerCase()} item</button>
        </form>
      </section>
      <section className="tile">
        <h2>{items?.length ?? 0} items</h2>
        {items?.length ? (
          <table className="table">
            <thead><tr><th /><th>Item</th><th className="num">Price</th><th>In stock</th><th>Website</th><th /></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id}>
                <td>{i.image_url ? <img src={i.image_url} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} /> : null}</td>
                <td>{i.name}{i.category ? ` · ${i.category}` : ''}</td>
                <td className="num">{money(i.selling_price)}{i.original_price ? <s style={{ opacity: 0.6, marginLeft: 6 }}>{money(i.original_price)}</s> : null}</td>
                <td>
                  <form action={setItemQuantity} style={{ display: 'flex', gap: 6 }}>
                    <input type="hidden" name="id" value={i.id} />
                    <input name="quantity" type="number" min="0" defaultValue={i.quantity} style={{ width: 80 }} />
                    <button type="submit" className="secondary">Save</button>
                  </form>
                </td>
                <td>
                  {i.image_url && (i.selling_price ?? 0) > 0 ? <>On the website · {KINDS[i.website_category as Kind]?.label ?? '—'}</> : (
                    <form action={completeItem} style={{ display: 'grid', gap: 4 }}>
                      <input type="hidden" name="id" value={i.id} />
                      <span>Not on the website yet: needs {[!i.image_url && 'a photo', !((i.selling_price ?? 0) > 0) && 'a selling price'].filter(Boolean).join(' and ')}</span>
                      {!((i.selling_price ?? 0) > 0) && <input name="selling_price" type="number" step="any" min="0" placeholder="Selling price" />}
                      {!i.image_url && <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />}
                      <button type="submit" className="secondary">Save</button>
                    </form>
                  )}
                </td>
                <td><form action={deleteItem}><input type="hidden" name="id" value={i.id} /><button type="submit" className="secondary">Remove</button></form></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p>No items yet. Add the first one above.</p>}
      </section>
    </Shell>
  );
}
