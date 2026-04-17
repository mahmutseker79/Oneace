# Field Mapping Reference

**Last updated: 2026-04-17**

This document maps source system fields to OneAce's canonical **Raw*** types. Use this when debugging field mappings or adding a new source adapter.

---

## Sortly → OneAce

**Adapter**: `src/lib/migrations/sortly/adapter.ts`
**Default Mappings**: `src/lib/migrations/sortly/default-mappings.ts`

| Sortly Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| Name | String | RawItem.name | Yes | — |
| SKU | String | RawItem.sku | Yes | Must be unique per org |
| Quantity | Number | RawStockLevel.quantity | No | Single warehouse assumed |
| Folder | String | RawCategory.externalId | No | Folder name (no path) |
| Folder Path | String | RawCategory.externalId | No | Full path with "/" separators |
| Price | Number | RawItem.salePrice | No | — |
| Minimum Level | Number | RawItem.reorderPoint | No | — |
| Notes | String | RawItem.description | No | — |
| Tags | String | RawCustomFieldValue | No | Split by comma or semicolon |
| Photos | String | RawAttachment.sourceRef | No | Pipe-separated filenames (photo1.jpg\|photo2.jpg) |
| Field: {customName} | * | RawItem.customFieldValues | No | Type inferred; see Custom Fields below |

### Sortly Custom Field Mapping

Sortly custom field columns are detected via the `Field: ` prefix. OneAce auto-suggests mappings:

```
Field: Color       → CustomField.color (confidence 0.8 if "color" in column name)
Field: Manufacturer → CustomField.brand (confidence 0.5 if "manufacturer" in name)
Field: Weight      → (no suggestion, confidence 0.3)
```

**Default mapping logic** (`default-mappings.ts`):
```javascript
const keywordMap = {
  "weight": "weight",
  "dimension": "dimensions",
  "color": "color",
  "size": "size",
  "brand": "brand",
  "barcode": "barcode",
  "supplier": "preferredSupplier",
  "vendor": "preferredSupplier"
};
```

---

## inFlow CSV → OneAce

**Adapter**: `src/lib/migrations/inflow/adapter.ts`
**Parser**: `src/lib/migrations/inflow/parser.ts`
**Default Mappings**: `src/lib/migrations/inflow/default-mappings.ts`

### Products.csv

| inFlow Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| ProductID | String | RawItem.externalId | Yes | Must be unique |
| ProductName | String | RawItem.name | Yes | — |
| SKU | String | RawItem.sku | Yes | Unique per org |
| ReorderLevel | Number | RawItem.reorderPoint | No | — |
| ReorderQty | Number | RawItem.reorderQty | No | — |
| UnitCost | Number | RawItem.costPrice | No | — |
| SalePrice | Number | RawItem.salePrice | No | — |
| DefaultUOM | String | RawItem.unit | No | Unit of measure (EA, CASE, etc.) |
| Description | String | RawItem.description | No | — |
| CategoryID | String | RawCategory.externalId | No | Maps to parent category |

### Vendors.csv

| inFlow Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| VendorID | String | RawSupplier.externalId | Yes | — |
| VendorName | String | RawSupplier.name | Yes | — |
| Contact | String | RawSupplier.contactName | No | — |
| Email | String | RawSupplier.email | No | — |
| Phone | String | RawSupplier.phone | No | — |
| Address | String | RawSupplier.address | No | — |

### StockLevels.csv

| inFlow Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| ProductID | String | RawStockLevel.itemExternalId | Yes | — |
| WarehouseCode | String | RawWarehouse.externalId | Yes | — |
| LocationCode | String | RawLocation.externalId | No | Bin/sublocation |
| OnHandQty | Number | RawStockLevel.quantity | Yes | — |

### PurchaseOrders.csv + PurchaseOrderItems.csv

See Purchase Orders section below.

---

## Fishbowl CSV → OneAce

**Adapter**: `src/lib/migrations/fishbowl/adapter.ts`
**Parser**: `src/lib/migrations/fishbowl/csv-parser.ts`
**Status Map**: `src/lib/migrations/fishbowl/status-map.ts`

### Items.csv

| Fishbowl Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| ItemID | String | RawItem.externalId | Yes | — |
| ItemNumber | String | RawItem.sku | Yes | — |
| Description | String | RawItem.name | Yes | Fallback if Name missing |
| UnitOfMeasure | String | RawItem.unit | No | Base UOM only |
| CostPrice | Number | RawItem.costPrice | No | — |
| SalePrice | Number | RawItem.salePrice | No | — |
| Notes | String | RawItem.description | No | — |

### Vendors.csv

| Fishbowl Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| VendorID | String | RawSupplier.externalId | Yes | — |
| VendorName | String | RawSupplier.name | Yes | — |
| Contact | String | RawSupplier.contactName | No | — |
| Phone | String | RawSupplier.phone | No | — |
| Email | String | RawSupplier.email | No | — |

### Locations.csv (Bins)

| Fishbowl Column | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| BinID | String | RawLocation.externalId | Yes | — |
| BinName | String | RawLocation.name | Yes | — |
| WarehouseID | String | RawWarehouse.externalId | Yes | — |

### Purchase Order Status Mapping

| Fishbowl Status | OneAce PurchaseOrderStatus |
|---|---|
| OPEN | PENDING |
| RECEIVED_PARTIAL | PARTIAL_RECEIVED |
| RECEIVED | RECEIVED |
| CLOSED | CLOSED |
| CANCELLED | CANCELLED |

---

## Cin7 Core API → OneAce

**Adapter**: `src/lib/migrations/cin7/adapter.ts`
**API Client**: `src/lib/migrations/cin7/api-client.ts`

### Products Endpoint

Cin7 API returns JSON objects:

```json
{
  "id": "12345",
  "code": "SKU-001",
  "name": "Product Name",
  "description": "...",
  "costPrice": 10.50,
  "salePrice": 29.99,
  "reorderLevel": 5,
  "defaultUnitCode": "EA"
}
```

Maps to:

| Cin7 Field | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|
| id | RawItem.externalId | Yes | — |
| code | RawItem.sku | Yes | — |
| name | RawItem.name | Yes | — |
| description | RawItem.description | No | — |
| costPrice | RawItem.costPrice | No | — |
| salePrice | RawItem.salePrice | No | — |
| reorderLevel | RawItem.reorderPoint | No | — |
| defaultUnitCode | RawItem.unit | No | — |

### Suppliers Endpoint

```json
{
  "id": "vendor-123",
  "name": "Acme Corp",
  "contact": "John Doe",
  "email": "john@acme.com",
  "phone": "+1 555 1234",
  "address": "123 Main St"
}
```

Maps to:

| Cin7 Field | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|
| id | RawSupplier.externalId | Yes | — |
| name | RawSupplier.name | Yes | — |
| contact | RawSupplier.contactName | No | — |
| email | RawSupplier.email | No | — |
| phone | RawSupplier.phone | No | — |
| address | RawSupplier.address | No | — |

### Stock Levels Endpoint

TBD — details pending from Cin7 API docs.

---

## SOS Inventory (QuickBooks) → OneAce

**Adapter**: `src/lib/migrations/sos-inventory/adapter.ts`
**API Client**: `src/lib/migrations/sos-inventory/api-client.ts`

TBD — SOS API field mappings pending.

---

## Common Custom Field Patterns

Across all sources, custom fields follow this pattern:

**Input** (RawCustomFieldValue):
```typescript
{
  fieldType: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "URL",
  valueText?: string,
  valueNumber?: number,
  valueDate?: string (ISO 8601),
  valueBoolean?: boolean,
  valueJson?: unknown (for MULTI_SELECT array)
}
```

**Output** (ItemCustomFieldValue):
- Exactly one column is populated based on `fieldType`
- Others are null
- Type validation enforced at import time

### Example: Sortly "Color" Field (SELECT)

**Source** (Sortly CSV):
```
SKU,Name,"Field: Color"
MK-500-BLU,"Measuring Cup","Blue"
MK-500-RED,"Measuring Cup","Red"
```

**Parsed** (RawItem):
```javascript
{
  sku: "MK-500-BLU",
  name: "Measuring Cup",
  customFieldValues: {
    "Color": {
      fieldType: "SELECT",
      valueText: "Blue"
    }
  }
}
```

**Stored** (ItemCustomFieldValue):
```sql
INSERT INTO ItemCustomFieldValue (itemId, customFieldDefinitionId, valueText)
VALUES (item_123, field_456, 'Blue');
```

---

## UOM (Units of Measure) Normalization

Some sources (Fishbowl, Cin7) include UOM hierarchies; OneAce stores one primary unit per item.

| Source | Handling |
|---|---|
| Sortly | No UOM tracking |
| inFlow | `DefaultUOM` column → RawItem.unit |
| Fishbowl | `UnitOfMeasure` (base only) → RawItem.unit; hierarchy discarded with WARNING |
| Cin7 | `defaultUnitCode` → RawItem.unit |
| SOS Inventory | TBD |

**Normalization Note**: If a source item has sub-units (e.g., CASE → 12 EA), only the base unit is imported. Conversions are flagged as WARNING.

---

## Attachment File Extensions

Supported file types for `RawAttachment`:

| Extension | MIME Type | Allowed? |
|---|---|---|
| .jpg, .jpeg | image/jpeg | ✓ |
| .png | image/png | ✓ |
| .pdf | application/pdf | ✓ |
| .csv | text/csv | ✓ |
| .xls, .xlsx | application/vnd.ms-excel | ✓ |
| .gif | image/gif | ⚠ (legacy, not recommended) |
| .webp | image/webp | ✓ |

Unsupported types are flagged as WARNING; the attachment is skipped.

---

---

## QuickBooks Online → OneAce

**Adapter**: `src/lib/migrations/quickbooks-online/adapter.ts`

Uses the **Intuit QuickBooks Online API** (REST). Real-time field mapping from QBO's Item, Vendor, and PurchaseOrder resources.

| QBO API Field | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| Item.Name | String | RawItem.name | Yes | — |
| Item.SKU | String | RawItem.sku | Yes | Unique per org |
| Item.Desc | String | RawItem.description | No | — |
| Item.UnitPrice | Number | RawItem.salePrice | No | — |
| Item.PurchaseCost | Number | RawItem.costPrice | No | — |
| Item.InvStartDate | Date | RawItem.createdAt | No | — |
| Item.Type | String | RawItem.category | No | Type mapping: **InventoryItem** → product; **Hizmet** → skipped |
| Item.QtyOnHand | Number | RawStockLevel.quantity | No | Synthetic warehouse: `QB_Online_Inventory` |

| Vendor.Name | String | RawSupplier.name | Yes | — |
| Vendor.Email | String | RawSupplier.email | No | — |
| Vendor.Phone | String | RawSupplier.phone | No | — |
| Vendor.Addr | String | RawSupplier.address | No | — |

| PurchaseOrder.DocNumber | String | RawPurchaseOrder.referenceNumber | Yes | — |
| PurchaseOrder.DueDate | Date | RawPurchaseOrder.dueDate | No | — |
| PurchaseOrder.TxnDate | Date | RawPurchaseOrder.orderDate | Yes | — |
| PurchaseOrder.Status | String | RawPurchaseOrder.status | Yes | Enum: OPEN, CLOSED |

### QBO Gotchas

- **Rate Limit**: 500 req/min per realm
- **Sub-items**: Only 1 level depth imported
- **Service Items**: Skipped (no inventory tracking)
- **Attachment URLs**: 15-minute expiry; OneAce uploads to Blob immediately

---

## QuickBooks Desktop (IIF) → OneAce

**Adapter**: `src/lib/migrations/quickbooks-desktop/adapter.ts`

Parses **Interchange File Format (IIF)** exports from QBD. IIF is a line-delimited text format; OneAce extracts blocks: INVITEM, VEND, TRNS, CUSTFLD.

| IIF Block Field | Type | OneAce Raw* Field | Required? | Notes |
|---|---|---|---|---|
| INVITEM/NAME | String | RawItem.name | Yes | — |
| INVITEM/BARCOD | String | RawItem.barcode | No | — |
| INVITEM/DESC | String | RawItem.description | No | — |
| INVITEM/PRICE | Number | RawItem.salePrice | No | — |
| INVITEM/COST | Number | RawItem.costPrice | No | — |
| INVITEM/REFNO | String | RawItem.externalId | No | SKU fallback if empty |

| VEND/NAME | String | RawSupplier.name | Yes | — |
| VEND/EMAIL | String | RawSupplier.email | No | — |
| VEND/PHONE | String | RawSupplier.phone | No | — |
| VEND/ADDR{1-4} | String | RawSupplier.address | No | Concatenated, space-separated |

| TRNS/TRNSID (PO) | String | RawPurchaseOrder.referenceNumber | Yes | — |
| TRNS/TRNSDATE | Date (MM/DD/YYYY) | RawPurchaseOrder.orderDate | Yes | Auto-converted to ISO 8601 |
| TRNS/DUEDATE | Date (MM/DD/YYYY) | RawPurchaseOrder.dueDate | No | Auto-converted |

| CUSTFLD/NAME | String | CustomFieldDefinition.name | Yes | User-defined field |
| CUSTFLD/VALUE | * | CustomFieldValue.value{Text\|Number\|Date} | No | Type inferred from value |

### QBD IIF Gotchas

- **Charset**: Windows-1252; auto-converted to UTF-8
- **Name as ID**: Item/Vendor names must be stable; renaming breaks linking
- **Dates**: IIF format is MM/DD/YYYY; invalid dates skipped with WARNING
- **Negative Stock**: Allowed; flagged as WARNING
- **Service Items**: Not exported in IIF (type filtering)

---

## Reserved Field Names

OneAce reserves the following field keys for system use:

```
externalId, externalSource, organizationId, sku, name, barcode, 
categoryId, preferredSupplierId, unit, costPrice, salePrice, 
reorderPoint, reorderQty, status, description
```

Custom field keys must not collide with these (validation enforced).

