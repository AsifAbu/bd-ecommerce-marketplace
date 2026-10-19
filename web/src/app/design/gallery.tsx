"use client";

import { Heart, MoreHorizontal, ShoppingBag } from "lucide-react";
import {
  Badge,
  Breadcrumbs,
  Button,
  buttonStyles,
  Container,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Pagination,
  Price,
  ProductCard,
  ProductGrid,
  ProductGridSkeleton,
  Rating,
  Section,
  Select,
  Sheet,
  SheetContent,
  SheetTrigger,
  Textarea,
  useToast,
} from "@/components/ui";

const swatches = [
  ["ink", "bg-ink"],
  ["paper", "bg-paper border border-line"],
  ["surface", "bg-surface"],
  ["line", "bg-line"],
  ["edge", "bg-edge"],
  ["muted", "bg-muted"],
  ["jade", "bg-jade"],
  ["jade-hover", "bg-jade-hover"],
  ["jade-soft", "bg-jade-soft"],
  ["vermilion", "bg-vermilion"],
  ["vermilion-soft", "bg-vermilion-soft"],
  ["gold", "bg-gold"],
];

export function Gallery() {
  const { toast } = useToast();
  return (
    <Container as="main" id="main" className="flex flex-col gap-12 py-8">
      <h1 className="text-3xl font-semibold">UI kit</h1>

      <Section title="Colour">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {swatches.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-1 text-sm">
              <span className={`h-12 rounded-md ${cls}`} />
              {name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-2">
          <p className="text-4xl font-semibold tracking-tight">Display 38 - Instrument Sans</p>
          <p className="text-2xl font-semibold">Heading 24 - শাড়ি, বই, পাঞ্জাবি</p>
          <p className="text-base">Body 16. Cash on delivery across Bangladesh. পণ্য হাতে পেয়ে টাকা দিন।</p>
          <p lang="bn" className="text-base">
            বাংলা লেখা: শাড়ি, বই, ঘড়ি, জুতা, কম্পিউটার
          </p>
          <p className="tabular text-sm text-muted">Tabular numerals: Tk 1,234.50 / Tk 9,876.00</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Add to cart</Button>
          <Button variant="secondary">Save for later</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Remove shop</Button>
          <Button loading>Placing order</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <a href="/cart" className={buttonStyles({ variant: "secondary" })}>
            Link as button
          </a>
          <IconButton label="Add to wishlist" icon={<Heart aria-hidden="true" size={20} />} variant="outline" />
          <Button onClick={() => toast("Added to cart")}>
            <ShoppingBag aria-hidden="true" size={18} />
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-xl gap-4">
          <FormField label="Mobile number" hint="Eleven digits, starting with 01" required>
            {(p) => <Input name="phone" inputMode="tel" {...p} />}
          </FormField>
          <FormField label="Email" error="Enter an email like name@example.com">
            {(p) => <Input name="email" type="email" defaultValue="name@" {...p} />}
          </FormField>
          <FormField label="District">
            {(p) => (
              <Select name="district" defaultValue="" {...p}>
                <option value="" disabled>
                  Choose…
                </option>
                <option>Dhaka</option>
                <option>Chattogram</option>
              </Select>
            )}
          </FormField>
          <FormField label="Delivery note">{(p) => <Textarea name="note" {...p} />}</FormField>
        </div>
      </Section>

      <Section title="Badges, price, rating">
        <div className="flex flex-wrap items-center gap-4">
          <Badge>Out of stock</Badge>
          <Badge tone="brand">Verified shop</Badge>
          <Badge tone="sale">-20%</Badge>
          <Badge tone="warning">Only 2 left</Badge>
          <Price amount={1850} />
          <Price amount={1480} original={1850} />
          <Price min={1850} max={2450} />
          <Price amount={2990} size="lg" />
          <Rating value={4.5} count={12} />
          <Rating value={null} />
        </div>
      </Section>

      <Section title="Product cards">
        <ProductGrid label="Sample products">
          <ProductCard href="#" title="Wayfarer sunglasses with polarised lenses and a very long title that runs to two lines" imageUrl={null} categoryName="Eyewear" priceMin={1850} priceMax={1850} shopName="Test Optics" shopVerified rating={4.6} ratingCount={18} />
          <ProductCard href="#" title="Cotton panjabi" imageUrl={null} categoryName="Clothing" priceMin={1480} priceMax={1480} originalPrice={1850} shopName="Rupa Fashion" />
          <ProductCard href="#" title="শাড়ি, জামদানি" imageUrl={null} categoryName="Clothing" priceMin={3200} priceMax={4800} shopName="তাঁত ঘর" outOfStock />
          <ProductCard
            href="#"
            title="Linen shirt"
            imageUrl={null}
            categoryName="Clothing"
            priceMin={1250}
            priceMax={1250}
            action={<Button variant="secondary" size="sm" block>Try on</Button>}
          />
        </ProductGrid>
        <ProductGridSkeleton count={5} />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Sheet>
            <SheetTrigger className={buttonStyles({ variant: "secondary" })}>Open drawer</SheetTrigger>
            <SheetContent title="Filters" side="right">
              <p className="p-4 text-muted">Drawer content scrolls inside the panel.</p>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Row actions" className={buttonStyles({ variant: "ghost" })}>
              <MoreHorizontal aria-hidden="true" size={20} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => toast("Edited")}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast("Could not delete", "error")}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Section>

      <Section title="Navigation and empty state">
        <Breadcrumbs items={[{ label: "All categories", href: "/categories" }, { label: "Eyewear", href: "/c/eyewear" }, { label: "Sunglasses" }]} />
        <Pagination page={4} totalPages={12} hrefFor={(p) => `#page-${p}`} />
        <EmptyState
          title="Your cart is empty"
          description="Find something you like and it will wait for you here."
          action={<a href="/categories" className={buttonStyles()}>Browse categories</a>}
        />
      </Section>
    </Container>
  );
}
