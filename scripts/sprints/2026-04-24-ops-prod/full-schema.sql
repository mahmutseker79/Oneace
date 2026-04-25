-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER', 'APPROVER', 'COUNTER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('ACTIVE', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER', 'COUNT', 'BIN_TRANSFER');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('FREIGHT', 'DUTY', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "AllocationBasis" AS ENUM ('BY_VALUE', 'BY_QTY', 'BY_WEIGHT', 'BY_VOLUME');

-- CreateEnum
CREATE TYPE "StockCountState" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ROLLED_BACK', 'REQUIRES_RECOUNT');

-- CreateEnum
CREATE TYPE "CountMethodology" AS ENUM ('CYCLE', 'FULL', 'SPOT', 'BLIND', 'DOUBLE_BLIND', 'DIRECTED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CountRole" AS ENUM ('COUNTER', 'VERIFIER', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CountScope" AS ENUM ('FULL', 'PARTIAL', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "LabelType" AS ENUM ('BIN', 'ITEM', 'WAREHOUSE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BarcodeFormat" AS ENUM ('CODE128', 'EAN13', 'QR', 'CODE39', 'UPC_A', 'ITF14');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('CSV', 'EXCEL', 'QUICKBOOKS_ONLINE', 'QUICKBOOKS_DESKTOP', 'SHOPIFY', 'WOOCOMMERCE', 'XERO', 'AMAZON', 'CUSTOM_API', 'MANUAL');

-- CreateEnum
CREATE TYPE "ImportEntity" AS ENUM ('ITEM', 'STOCK_LEVEL', 'SUPPLIER', 'PURCHASE_ORDER', 'CATEGORY', 'WAREHOUSE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('QUICKBOOKS_ONLINE', 'QUICKBOOKS_DESKTOP', 'SHOPIFY', 'WOOCOMMERCE', 'XERO', 'AMAZON', 'CUSTOM_WEBHOOK', 'BIGCOMMERCE', 'MAGENTO', 'WIX', 'ODOO', 'ZOHO_INVENTORY');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('MANUAL', 'REALTIME', 'EVERY_5_MIN', 'EVERY_15_MIN', 'EVERY_30_MIN', 'HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ConflictPolicy" AS ENUM ('REMOTE_WINS', 'LOCAL_WINS', 'NEWEST_WINS', 'MANUAL_REVIEW', 'SKIP');

-- CreateEnum
CREATE TYPE "RetryPolicy" AS ENUM ('NONE', 'LINEAR', 'EXPONENTIAL');

-- CreateEnum
CREATE TYPE "SyncRuleAction" AS ENUM ('SYNC', 'SKIP', 'TRANSFORM', 'FLAG_REVIEW', 'CREATE_ONLY', 'UPDATE_ONLY');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('STOCK_VALUE', 'LOW_STOCK', 'COUNT_VARIANCE', 'MOVEMENT_HISTORY', 'ABC_ANALYSIS', 'DEPARTMENT_VARIANCE', 'COUNT_COMPARISON', 'STOCK_AGING', 'SUPPLIER_PERFORMANCE', 'SCAN_ACTIVITY');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'XLSX', 'CSV');

-- CreateEnum
CREATE TYPE "ReasonCategory" AS ENUM ('VARIANCE', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'DISPOSAL', 'COUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('IN_STOCK', 'ISSUED', 'IN_TRANSIT', 'SOLD', 'RETURNED', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "SerialAction" AS ENUM ('RECEIVED', 'MOVED', 'ISSUED', 'RETURNED', 'COUNTED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'DOCUMENT', 'DATASHEET', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('ZONE', 'AISLE', 'RACK', 'SHELF', 'BAY', 'FLOOR');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'SHIPPED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ALLOCATED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KitType" AS ENUM ('BUNDLE', 'KIT', 'ASSEMBLY');

-- CreateEnum
CREATE TYPE "PickStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PICKED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'HOLD', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'IN_TRANSIT', 'RESERVED');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('PRIMARY', 'ALTERNATE', 'CASE', 'INNER', 'PALLET', 'SUPPLIER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('EQUIPMENT', 'FURNITURE', 'ELECTRONICS', 'VEHICLE', 'BUILDING', 'IT_HARDWARE', 'SOFTWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'IN_STORAGE', 'IN_MAINTENANCE', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "AssetAction" AS ENUM ('ASSIGNED', 'RETURNED', 'MOVED', 'AUDITED', 'MAINTAINED', 'DISPOSED', 'VALUE_ADJUSTED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('AVAILABLE', 'QUARANTINE', 'EXPIRED', 'RECALLED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "MigrationSource" AS ENUM ('SORTLY', 'INFLOW', 'ODOO', 'ZOHO_INVENTORY', 'FISHBOWL', 'CIN7', 'SOS_INVENTORY', 'QUICKBOOKS_ONLINE', 'QUICKBOOKS_DESKTOP', 'KATANA', 'LIGHTSPEED', 'QUICKBOOKS_COMMERCE', 'DEAR_SYSTEMS', 'GENERIC_CSV');

-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('ITEM', 'SUPPLIER', 'WAREHOUSE', 'PURCHASE_ORDER');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'URL');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'FILES_UPLOADED', 'MAPPING_REVIEW', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "billingInterval" TEXT NOT NULL DEFAULT 'month',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelAt" TIMESTAMP(3),
    "defaultLocale" TEXT,
    "defaultRegion" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "onboardingCompletedAt" TIMESTAMP(3),
    "migrationSourceHint" "MigrationSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "uiState" JSONB,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailStatus" "EmailStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailStatusUpdatedAt" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "barcodeValue" TEXT,
    "labelTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bin" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "barcodeValue" TEXT,
    "displayName" TEXT,
    "labelTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "preferredSupplierId" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "costPrice" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "reorderQty" INTEGER NOT NULL DEFAULT 0,
    "status" "ItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "imageUrl" TEXT,
    "abcClass" TEXT DEFAULT 'C',
    "departmentId" TEXT,
    "lastCountedAt" TIMESTAMP(3),
    "countFrequency" INTEGER,
    "hasVariants" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "trackSerialNumbers" BOOLEAN NOT NULL DEFAULT false,
    "defaultExpiryDays" INTEGER,
    "isFixedAsset" BOOLEAN NOT NULL DEFAULT false,
    "minOrderQty" INTEGER,
    "maxOrderQty" INTEGER,
    "leadTimeDays" INTEGER,
    "externalId" TEXT,
    "externalSource" "MigrationSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "locationLevelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "toWarehouseId" TEXT,
    "toBinId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" INTEGER NOT NULL DEFAULT 1,
    "reference" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT,
    "stockCountId" TEXT,
    "reasonCodeId" TEXT,
    "serialNumberId" TEXT,
    "batchId" TEXT,
    "purchaseUnitCost" DECIMAL(18,6),
    "landedUnitCost" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandedCostAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "sourceMovementId" TEXT NOT NULL,
    "allocationType" "AllocationType" NOT NULL,
    "allocationBasis" "AllocationBasis" NOT NULL,
    "allocatedAmount" DECIMAL(18,6) NOT NULL,
    "isRevaluation" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "LandedCostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "name" TEXT NOT NULL,
    "state" "StockCountState" NOT NULL DEFAULT 'OPEN',
    "methodology" "CountMethodology" NOT NULL DEFAULT 'CYCLE',
    "scope" "CountScope" NOT NULL DEFAULT 'FULL',
    "departmentId" TEXT,
    "parentCountId" TEXT,
    "templateId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "ApprovalStatus",
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "countedQuantity" INTEGER NOT NULL,
    "counterTag" TEXT,
    "note" TEXT,
    "departmentId" TEXT,
    "assignmentId" TEXT,
    "photoUrl" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "reasonCodeId" TEXT,
    "serialNumberId" TEXT,
    "variantId" TEXT,
    "batchId" TEXT,
    "zoneId" TEXT,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedByUserId" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "CountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "freightCost" DECIMAL(18,4),
    "dutyCost" DECIMAL(18,4),
    "insuranceCost" DECIMAL(18,4),
    "otherLandedCost" DECIMAL(18,4),
    "landedCostCurrency" TEXT DEFAULT 'USD',
    "landedAllocationBasis" "AllocationBasis" NOT NULL DEFAULT 'BY_VALUE',

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL DEFAULT 'LOW_STOCK',
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "currentQty" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "dedupKey" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyWebhookEvent" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopifyWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "organizationId" TEXT,
    "externalId" TEXT NOT NULL,
    "bodyHash" TEXT,
    "eventType" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "color" TEXT,
    "managerId" TEXT,
    "warehouseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "warehouseId" TEXT,
    "role" "CountRole" NOT NULL DEFAULT 'COUNTER',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "itemsCounted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CountApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "methodology" "CountMethodology" NOT NULL,
    "scope" "CountScope" NOT NULL DEFAULT 'FULL',
    "warehouseId" TEXT,
    "departmentId" TEXT,
    "categoryIds" TEXT[],
    "itemFilter" JSONB,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "cronExpression" TEXT,
    "nextScheduledAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LabelType" NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "layout" JSONB NOT NULL,
    "barcodeFormat" "BarcodeFormat" NOT NULL DEFAULT 'CODE128',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "entityType" "ImportEntity" NOT NULL,
    "fieldMapping" JSONB NOT NULL,
    "transformRules" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT,
    "source" "ImportSource" NOT NULL,
    "entityType" "ImportEntity" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentials" JSONB,
    "settings" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "syncFrequency" "SyncFrequency" NOT NULL DEFAULT 'MANUAL',
    "syncDirection" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "conflictPolicy" "ConflictPolicy" NOT NULL DEFAULT 'REMOTE_WINS',
    "retryPolicy" "RetryPolicy" NOT NULL DEFAULT 'EXPONENTIAL',
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "syncItems" BOOLEAN NOT NULL DEFAULT true,
    "syncOrders" BOOLEAN NOT NULL DEFAULT true,
    "syncSuppliers" BOOLEAN NOT NULL DEFAULT false,
    "syncCategories" BOOLEAN NOT NULL DEFAULT false,
    "syncStockLevels" BOOLEAN NOT NULL DEFAULT true,
    "syncPrices" BOOLEAN NOT NULL DEFAULT true,
    "syncImages" BOOLEAN NOT NULL DEFAULT false,
    "syncCustomers" BOOLEAN NOT NULL DEFAULT false,
    "syncFilterJson" JSONB,
    "externalAccountId" TEXT,
    "externalStoreName" TEXT,
    "webhookSecret" TEXT,
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationFieldMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" "ImportEntity" NOT NULL,
    "localField" TEXT NOT NULL,
    "remoteField" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "transformRule" TEXT,
    "defaultValue" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncRule" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "ImportEntity" NOT NULL,
    "condition" JSONB NOT NULL,
    "action" "SyncRuleAction" NOT NULL DEFAULT 'SYNC',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSyncRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncSchedule" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" "ImportEntity" NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSyncSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "entityType" "ImportEntity" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationKind" TEXT NOT NULL,
    "taskKind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "responseJson" JSONB,
    "state" TEXT NOT NULL DEFAULT 'IN_FLIGHT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "filters" JSONB,
    "format" "ExportFormat" NOT NULL DEFAULT 'PDF',
    "cronExpression" TEXT NOT NULL,
    "recipientEmails" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasonCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ReasonCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReasonCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "serialNumber" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "warehouseId" TEXT,
    "binId" TEXT,
    "batchId" TEXT,
    "receivedDate" TIMESTAMP(3),
    "soldDate" TIMESTAMP(3),
    "lastMovedAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialHistory" (
    "id" TEXT NOT NULL,
    "serialNumberId" TEXT NOT NULL,
    "action" "SerialAction" NOT NULL,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "reference" TEXT,
    "performedByUserId" TEXT,
    "note" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" "AttachmentType" NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "page" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "sortBy" TEXT,
    "sortOrder" TEXT,
    "columns" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "shippedByUserId" TEXT,
    "receivedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "batchId" TEXT,
    "serialNumberId" TEXT,
    "shippedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "discrepancy" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "customerRef" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "allocatedQty" INTEGER NOT NULL DEFAULT 0,
    "shippedQty" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "KitType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitComponent" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "componentItemId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KitComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesOrderLineId" TEXT,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "fromBinId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "PickStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToUserId" TEXT,
    "pickedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferNumberPrefix" TEXT NOT NULL DEFAULT 'TRF',
    "transferNumberSequence" INTEGER NOT NULL DEFAULT 1,
    "salesOrderPrefix" TEXT NOT NULL DEFAULT 'SO',
    "salesOrderSequence" INTEGER NOT NULL DEFAULT 1,
    "assetTagPrefix" TEXT NOT NULL DEFAULT 'FA',
    "assetTagSequence" INTEGER NOT NULL DEFAULT 1,
    "batchNumberPrefix" TEXT NOT NULL DEFAULT 'LOT',
    "batchNumberSequence" INTEGER NOT NULL DEFAULT 1,
    "requireCountApproval" BOOLEAN NOT NULL DEFAULT false,
    "varianceThreshold" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "recountOnThreshold" BOOLEAN NOT NULL DEFAULT true,
    "defaultCountMethodology" TEXT NOT NULL DEFAULT 'FULL',
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "defaultStockStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOptionGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOptionValue" (
    "id" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVariant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT,
    "costPrice" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "weight" DECIMAL(10,3),
    "imageUrl" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVariantOption" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,

    CONSTRAINT "ItemVariantOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemBarcode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "value" TEXT NOT NULL,
    "format" "BarcodeFormat" NOT NULL,
    "type" "BarcodeType" NOT NULL,
    "label" TEXT,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantStockLevel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantStockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantStockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "toWarehouseId" TEXT,
    "toBinId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" INTEGER NOT NULL DEFAULT 1,
    "reference" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "stockCountId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serialNumber" TEXT,
    "category" "AssetCategory" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(12,2),
    "currentValue" DECIMAL(12,2),
    "depreciationRate" DECIMAL(5,2),
    "warrantyExpiry" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "warehouseId" TEXT,
    "binId" TEXT,
    "barcodeValue" TEXT,
    "imageUrl" TEXT,
    "notes" TEXT,
    "lastAuditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "action" "AssetAction" NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "note" TEXT,
    "performedByUserId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "manufactureDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "supplierBatchRef" TEXT,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "quantity" INTEGER NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "costPrice" DECIMAL(12,2),
    "status" "BatchStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountZone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "barcodeValue" TEXT,
    "barcodeFormat" "BarcodeFormat" NOT NULL DEFAULT 'QR',
    "color" TEXT,
    "description" TEXT,
    "warehouseId" TEXT,
    "parentZoneId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "promoteToBin" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneLabel" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "templateId" TEXT,
    "printedAt" TIMESTAMP(3),
    "printedByUserId" TEXT,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourcePlatform" "MigrationSource" NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "sourceFiles" JSONB,
    "fieldMappings" JSONB,
    "validationReport" JSONB,
    "importResults" JSONB,
    "scopeOptions" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" "CustomFieldEntity" NOT NULL,
    "name" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "externalSource" "MigrationSource",
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCustomFieldValue" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(20,6),
    "valueDate" TIMESTAMP(3),
    "valueBoolean" BOOLEAN,
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronRun" (
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "result" JSONB,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("runId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_invitedById_idx" ON "Invitation"("invitedById");

-- CreateIndex
CREATE INDEX "Invitation_acceptedById_idx" ON "Invitation"("acceptedById");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_emailStatus_idx" ON "User"("emailStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");

-- CreateIndex
CREATE INDEX "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_organizationId_code_key" ON "Warehouse"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Bin_warehouseId_idx" ON "Bin"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_warehouseId_code_key" ON "Bin"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_organizationId_slug_key" ON "Category"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Item_organizationId_idx" ON "Item"("organizationId");

-- CreateIndex
CREATE INDEX "Item_organizationId_barcode_idx" ON "Item"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "Item_organizationId_status_idx" ON "Item"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Item_organizationId_preferredSupplierId_idx" ON "Item"("organizationId", "preferredSupplierId");

-- CreateIndex
CREATE INDEX "Item_organizationId_status_reorderPoint_idx" ON "Item"("organizationId", "status", "reorderPoint");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_departmentId_idx" ON "Item"("departmentId");

-- CreateIndex
CREATE INDEX "Item_organizationId_externalSource_idx" ON "Item"("organizationId", "externalSource");

-- CreateIndex
CREATE UNIQUE INDEX "Item_organizationId_sku_key" ON "Item"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Item_organizationId_externalSource_externalId_key" ON "Item"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "StockLevel_organizationId_idx" ON "StockLevel"("organizationId");

-- CreateIndex
CREATE INDEX "StockLevel_warehouseId_idx" ON "StockLevel"("warehouseId");

-- CreateIndex
CREATE INDEX "StockLevel_binId_idx" ON "StockLevel"("binId");

-- CreateIndex
CREATE INDEX "StockLevel_locationLevelId_idx" ON "StockLevel"("locationLevelId");

-- CreateIndex
CREATE INDEX "StockLevel_itemId_idx" ON "StockLevel"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_itemId_warehouseId_binId_key" ON "StockLevel"("itemId", "warehouseId", "binId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_createdAt_idx" ON "StockMovement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_itemId_idx" ON "StockMovement"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_warehouseId_idx" ON "StockMovement"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_type_idx" ON "StockMovement"("organizationId", "type");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_purchaseOrderLineId_idx" ON "StockMovement"("organizationId", "purchaseOrderLineId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_stockCountId_idx" ON "StockMovement"("organizationId", "stockCountId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_type_createdAt_idx" ON "StockMovement"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_binId_idx" ON "StockMovement"("binId");

-- CreateIndex
CREATE INDEX "StockMovement_toWarehouseId_idx" ON "StockMovement"("toWarehouseId");

-- CreateIndex
CREATE INDEX "StockMovement_toBinId_idx" ON "StockMovement"("toBinId");

-- CreateIndex
CREATE INDEX "StockMovement_createdByUserId_idx" ON "StockMovement"("createdByUserId");

-- CreateIndex
CREATE INDEX "StockMovement_reasonCodeId_idx" ON "StockMovement"("reasonCodeId");

-- CreateIndex
CREATE INDEX "StockMovement_serialNumberId_idx" ON "StockMovement"("serialNumberId");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_organizationId_idempotencyKey_key" ON "StockMovement"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LandedCostAllocation_organizationId_purchaseOrderId_idx" ON "LandedCostAllocation"("organizationId", "purchaseOrderId");

-- CreateIndex
CREATE INDEX "LandedCostAllocation_organizationId_sourceMovementId_idx" ON "LandedCostAllocation"("organizationId", "sourceMovementId");

-- CreateIndex
CREATE INDEX "LandedCostAllocation_organizationId_allocationType_appliedA_idx" ON "LandedCostAllocation"("organizationId", "allocationType", "appliedAt");

-- CreateIndex
CREATE INDEX "StockCount_organizationId_state_idx" ON "StockCount"("organizationId", "state");

-- CreateIndex
CREATE INDEX "StockCount_organizationId_createdAt_idx" ON "StockCount"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockCount_warehouseId_idx" ON "StockCount"("warehouseId");

-- CreateIndex
CREATE INDEX "StockCount_departmentId_idx" ON "StockCount"("departmentId");

-- CreateIndex
CREATE INDEX "StockCount_organizationId_state_createdAt_idx" ON "StockCount"("organizationId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "StockCount_createdByUserId_idx" ON "StockCount"("createdByUserId");

-- CreateIndex
CREATE INDEX "CountSnapshot_countId_idx" ON "CountSnapshot"("countId");

-- CreateIndex
CREATE INDEX "CountSnapshot_organizationId_idx" ON "CountSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "CountSnapshot_itemId_idx" ON "CountSnapshot"("itemId");

-- CreateIndex
CREATE INDEX "CountSnapshot_warehouseId_idx" ON "CountSnapshot"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "CountSnapshot_countId_itemId_warehouseId_key" ON "CountSnapshot"("countId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "CountEntry_countId_countedAt_idx" ON "CountEntry"("countId", "countedAt");

-- CreateIndex
CREATE INDEX "CountEntry_countId_itemId_idx" ON "CountEntry"("countId", "itemId");

-- CreateIndex
CREATE INDEX "CountEntry_organizationId_idx" ON "CountEntry"("organizationId");

-- CreateIndex
CREATE INDEX "CountEntry_binId_idx" ON "CountEntry"("binId");

-- CreateIndex
CREATE INDEX "CountEntry_warehouseId_idx" ON "CountEntry"("warehouseId");

-- CreateIndex
CREATE INDEX "CountEntry_departmentId_idx" ON "CountEntry"("departmentId");

-- CreateIndex
CREATE INDEX "CountEntry_assignmentId_idx" ON "CountEntry"("assignmentId");

-- CreateIndex
CREATE INDEX "CountEntry_reasonCodeId_idx" ON "CountEntry"("reasonCodeId");

-- CreateIndex
CREATE INDEX "CountEntry_serialNumberId_idx" ON "CountEntry"("serialNumberId");

-- CreateIndex
CREATE INDEX "CountEntry_variantId_idx" ON "CountEntry"("variantId");

-- CreateIndex
CREATE INDEX "CountEntry_batchId_idx" ON "CountEntry"("batchId");

-- CreateIndex
CREATE INDEX "CountEntry_zoneId_idx" ON "CountEntry"("zoneId");

-- CreateIndex
CREATE INDEX "CountEntry_countedByUserId_idx" ON "CountEntry"("countedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CountEntry_organizationId_idempotencyKey_key" ON "CountEntry"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_isActive_idx" ON "Supplier"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_name_idx" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_code_key" ON "Supplier"("organizationId", "code");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_idx" ON "PurchaseOrder"("organizationId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_status_idx" ON "PurchaseOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_supplierId_idx" ON "PurchaseOrder"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_warehouseId_idx" ON "PurchaseOrder"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_orderedAt_idx" ON "PurchaseOrder"("organizationId", "orderedAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdByUserId_idx" ON "PurchaseOrder"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_poNumber_key" ON "PurchaseOrder"("organizationId", "poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_organizationId_idx" ON "PurchaseOrderLine"("organizationId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "Alert_organizationId_itemId_type_status_idx" ON "Alert"("organizationId", "itemId", "type", "status");

-- CreateIndex
CREATE INDEX "Alert_organizationId_status_idx" ON "Alert"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Alert_organizationId_createdAt_idx" ON "Alert"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_organizationId_itemId_type_idx" ON "Alert"("organizationId", "itemId", "type");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_idx" ON "Notification"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Notification_alertId_idx" ON "Notification"("alertId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_userId_dedupKey_key" ON "Notification"("organizationId", "userId", "dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_eventId_key" ON "StripeWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_createdAt_idx" ON "StripeWebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyWebhookEvent_webhookId_key" ON "ShopifyWebhookEvent"("webhookId");

-- CreateIndex
CREATE INDEX "ShopifyWebhookEvent_createdAt_idx" ON "ShopifyWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ShopifyWebhookEvent_shopDomain_idx" ON "ShopifyWebhookEvent"("shopDomain");

-- CreateIndex
CREATE INDEX "WebhookDeliveryEvent_provider_receivedAt_idx" ON "WebhookDeliveryEvent"("provider", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDeliveryEvent_organizationId_provider_idx" ON "WebhookDeliveryEvent"("organizationId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDeliveryEvent_provider_externalId_key" ON "WebhookDeliveryEvent"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorAuth_userId_key" ON "TwoFactorAuth"("userId");

-- CreateIndex
CREATE INDEX "TwoFactorAuth_userId_idx" ON "TwoFactorAuth"("userId");

-- CreateIndex
CREATE INDEX "Department_organizationId_isActive_idx" ON "Department"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Department_warehouseId_idx" ON "Department"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- CreateIndex
CREATE INDEX "CountAssignment_organizationId_countId_idx" ON "CountAssignment"("organizationId", "countId");

-- CreateIndex
CREATE INDEX "CountAssignment_userId_status_idx" ON "CountAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX "CountAssignment_departmentId_idx" ON "CountAssignment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CountAssignment_countId_userId_key" ON "CountAssignment"("countId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CountApproval_countId_key" ON "CountApproval"("countId");

-- CreateIndex
CREATE INDEX "CountApproval_organizationId_status_idx" ON "CountApproval"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CountApproval_countId_idx" ON "CountApproval"("countId");

-- CreateIndex
CREATE INDEX "CountApproval_requestedById_idx" ON "CountApproval"("requestedById");

-- CreateIndex
CREATE INDEX "CountApproval_reviewedById_idx" ON "CountApproval"("reviewedById");

-- CreateIndex
CREATE INDEX "CountTemplate_organizationId_idx" ON "CountTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "CountTemplate_isRecurring_nextScheduledAt_idx" ON "CountTemplate"("isRecurring", "nextScheduledAt");

-- CreateIndex
CREATE INDEX "CountTemplate_warehouseId_idx" ON "CountTemplate"("warehouseId");

-- CreateIndex
CREATE INDEX "CountTemplate_departmentId_idx" ON "CountTemplate"("departmentId");

-- CreateIndex
CREATE INDEX "LabelTemplate_organizationId_type_idx" ON "LabelTemplate"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ImportTemplate_organizationId_source_idx" ON "ImportTemplate"("organizationId", "source");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_status_idx" ON "ImportJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_createdAt_idx" ON "ImportJob"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_templateId_idx" ON "ImportJob"("templateId");

-- CreateIndex
CREATE INDEX "ImportJob_createdByUserId_idx" ON "ImportJob"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_organizationId_provider_key" ON "Integration"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationFieldMapping_integrationId_idx" ON "IntegrationFieldMapping"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationFieldMapping_integrationId_entityType_localField_key" ON "IntegrationFieldMapping"("integrationId", "entityType", "localField");

-- CreateIndex
CREATE INDEX "IntegrationSyncRule_integrationId_idx" ON "IntegrationSyncRule"("integrationId");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEvent_integrationId_idx" ON "IntegrationWebhookEvent"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationWebhookEvent_integrationId_eventType_endpointUrl_key" ON "IntegrationWebhookEvent"("integrationId", "eventType", "endpointUrl");

-- CreateIndex
CREATE INDEX "IntegrationSyncSchedule_integrationId_idx" ON "IntegrationSyncSchedule"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSyncSchedule_integrationId_entityType_direction_key" ON "IntegrationSyncSchedule"("integrationId", "entityType", "direction");

-- CreateIndex
CREATE INDEX "SyncLog_integrationId_startedAt_idx" ON "SyncLog"("integrationId", "startedAt");

-- CreateIndex
CREATE INDEX "IntegrationTask_status_nextAttemptAt_idx" ON "IntegrationTask"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IntegrationTask_organizationId_integrationKind_idx" ON "IntegrationTask"("organizationId", "integrationKind");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_organizationId_actionName_createdAt_idx" ON "IdempotencyKey"("organizationId", "actionName", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_organizationId_keyHash_key" ON "IdempotencyKey"("organizationId", "keyHash");

-- CreateIndex
CREATE INDEX "ScheduledReport_organizationId_isActive_idx" ON "ScheduledReport"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ScheduledReport_isActive_nextSendAt_idx" ON "ScheduledReport"("isActive", "nextSendAt");

-- CreateIndex
CREATE INDEX "ReasonCode_organizationId_category_isActive_idx" ON "ReasonCode"("organizationId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReasonCode_organizationId_code_key" ON "ReasonCode"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SerialNumber_organizationId_itemId_idx" ON "SerialNumber"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "SerialNumber_organizationId_status_idx" ON "SerialNumber"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SerialNumber_serialNumber_idx" ON "SerialNumber"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_organizationId_serialNumber_key" ON "SerialNumber"("organizationId", "serialNumber");

-- CreateIndex
CREATE INDEX "SerialHistory_serialNumberId_performedAt_idx" ON "SerialHistory"("serialNumberId", "performedAt");

-- CreateIndex
CREATE INDEX "SerialHistory_fromWarehouseId_idx" ON "SerialHistory"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "SerialHistory_toWarehouseId_idx" ON "SerialHistory"("toWarehouseId");

-- CreateIndex
CREATE INDEX "SerialHistory_performedByUserId_idx" ON "SerialHistory"("performedByUserId");

-- CreateIndex
CREATE INDEX "ItemAttachment_organizationId_itemId_idx" ON "ItemAttachment"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "ItemAttachment_uploadedByUserId_idx" ON "ItemAttachment"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "SavedView_organizationId_page_idx" ON "SavedView"("organizationId", "page");

-- CreateIndex
CREATE INDEX "SavedView_userId_page_idx" ON "SavedView"("userId", "page");

-- CreateIndex
CREATE INDEX "SavedView_userId_idx" ON "SavedView"("userId");

-- CreateIndex
CREATE INDEX "LocationLevel_organizationId_warehouseId_idx" ON "LocationLevel"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "LocationLevel_parentId_idx" ON "LocationLevel"("parentId");

-- CreateIndex
CREATE INDEX "LocationLevel_warehouseId_idx" ON "LocationLevel"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationLevel_warehouseId_code_key" ON "LocationLevel"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "StockTransfer_organizationId_status_idx" ON "StockTransfer"("organizationId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_shippedByUserId_idx" ON "StockTransfer"("shippedByUserId");

-- CreateIndex
CREATE INDEX "StockTransfer_receivedByUserId_idx" ON "StockTransfer"("receivedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_organizationId_transferNumber_key" ON "StockTransfer"("organizationId", "transferNumber");

-- CreateIndex
CREATE INDEX "StockTransferLine_organizationId_idx" ON "StockTransferLine"("organizationId");

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferLine_itemId_idx" ON "StockTransferLine"("itemId");

-- CreateIndex
CREATE INDEX "StockTransferLine_variantId_idx" ON "StockTransferLine"("variantId");

-- CreateIndex
CREATE INDEX "StockTransferLine_batchId_idx" ON "StockTransferLine"("batchId");

-- CreateIndex
CREATE INDEX "StockTransferLine_serialNumberId_idx" ON "StockTransferLine"("serialNumberId");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_status_idx" ON "SalesOrder"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_organizationId_orderNumber_key" ON "SalesOrder"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrderLine_organizationId_idx" ON "SalesOrderLine"("organizationId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");

-- CreateIndex
CREATE INDEX "Kit_organizationId_idx" ON "Kit"("organizationId");

-- CreateIndex
CREATE INDEX "Kit_parentItemId_idx" ON "Kit"("parentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Kit_organizationId_parentItemId_key" ON "Kit"("organizationId", "parentItemId");

-- CreateIndex
CREATE INDEX "KitComponent_kitId_idx" ON "KitComponent"("kitId");

-- CreateIndex
CREATE UNIQUE INDEX "KitComponent_kitId_componentItemId_variantId_key" ON "KitComponent"("kitId", "componentItemId", "variantId");

-- CreateIndex
CREATE INDEX "PickTask_organizationId_status_idx" ON "PickTask"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PickTask_assignedToUserId_status_idx" ON "PickTask"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "PickTask_itemId_idx" ON "PickTask"("itemId");

-- CreateIndex
CREATE INDEX "PickTask_warehouseId_idx" ON "PickTask"("warehouseId");

-- CreateIndex
CREATE INDEX "PickTask_assignedToUserId_idx" ON "PickTask"("assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_organizationId_key" ON "OrgSettings"("organizationId");

-- CreateIndex
CREATE INDEX "ItemOptionGroup_organizationId_itemId_idx" ON "ItemOptionGroup"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "ItemOptionGroup_itemId_idx" ON "ItemOptionGroup"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOptionGroup_itemId_name_key" ON "ItemOptionGroup"("itemId", "name");

-- CreateIndex
CREATE INDEX "ItemOptionValue_optionGroupId_idx" ON "ItemOptionValue"("optionGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOptionValue_optionGroupId_value_key" ON "ItemOptionValue"("optionGroupId", "value");

-- CreateIndex
CREATE INDEX "ItemVariant_organizationId_itemId_idx" ON "ItemVariant"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "ItemVariant_organizationId_status_idx" ON "ItemVariant"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ItemVariant_itemId_idx" ON "ItemVariant"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVariant_organizationId_sku_key" ON "ItemVariant"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "ItemVariantOption_variantId_idx" ON "ItemVariantOption"("variantId");

-- CreateIndex
CREATE INDEX "ItemVariantOption_optionValueId_idx" ON "ItemVariantOption"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVariantOption_variantId_optionValueId_key" ON "ItemVariantOption"("variantId", "optionValueId");

-- CreateIndex
CREATE INDEX "ItemBarcode_organizationId_itemId_idx" ON "ItemBarcode"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "ItemBarcode_organizationId_variantId_idx" ON "ItemBarcode"("organizationId", "variantId");

-- CreateIndex
CREATE INDEX "ItemBarcode_value_idx" ON "ItemBarcode"("value");

-- CreateIndex
CREATE INDEX "ItemBarcode_itemId_idx" ON "ItemBarcode"("itemId");

-- CreateIndex
CREATE INDEX "ItemBarcode_variantId_idx" ON "ItemBarcode"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemBarcode_organizationId_value_key" ON "ItemBarcode"("organizationId", "value");

-- CreateIndex
CREATE INDEX "VariantStockLevel_organizationId_idx" ON "VariantStockLevel"("organizationId");

-- CreateIndex
CREATE INDEX "VariantStockLevel_variantId_idx" ON "VariantStockLevel"("variantId");

-- CreateIndex
CREATE INDEX "VariantStockLevel_warehouseId_idx" ON "VariantStockLevel"("warehouseId");

-- CreateIndex
CREATE INDEX "VariantStockLevel_binId_idx" ON "VariantStockLevel"("binId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantStockLevel_variantId_warehouseId_binId_key" ON "VariantStockLevel"("variantId", "warehouseId", "binId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_organizationId_variantId_idx" ON "VariantStockMovement"("organizationId", "variantId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_organizationId_createdAt_idx" ON "VariantStockMovement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "VariantStockMovement_organizationId_type_idx" ON "VariantStockMovement"("organizationId", "type");

-- CreateIndex
CREATE INDEX "VariantStockMovement_variantId_idx" ON "VariantStockMovement"("variantId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_itemId_idx" ON "VariantStockMovement"("itemId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_warehouseId_idx" ON "VariantStockMovement"("warehouseId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_binId_idx" ON "VariantStockMovement"("binId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_toWarehouseId_idx" ON "VariantStockMovement"("toWarehouseId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_toBinId_idx" ON "VariantStockMovement"("toBinId");

-- CreateIndex
CREATE INDEX "VariantStockMovement_createdByUserId_idx" ON "VariantStockMovement"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantStockMovement_organizationId_idempotencyKey_key" ON "VariantStockMovement"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FixedAsset_organizationId_status_idx" ON "FixedAsset"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FixedAsset_organizationId_category_idx" ON "FixedAsset"("organizationId", "category");

-- CreateIndex
CREATE INDEX "FixedAsset_organizationId_assignedToUserId_idx" ON "FixedAsset"("organizationId", "assignedToUserId");

-- CreateIndex
CREATE INDEX "FixedAsset_barcodeValue_idx" ON "FixedAsset"("barcodeValue");

-- CreateIndex
CREATE INDEX "FixedAsset_itemId_idx" ON "FixedAsset"("itemId");

-- CreateIndex
CREATE INDEX "FixedAsset_warehouseId_idx" ON "FixedAsset"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_organizationId_assetTag_key" ON "FixedAsset"("organizationId", "assetTag");

-- CreateIndex
CREATE INDEX "AssetHistory_organizationId_idx" ON "AssetHistory"("organizationId");

-- CreateIndex
CREATE INDEX "AssetHistory_assetId_performedAt_idx" ON "AssetHistory"("assetId", "performedAt");

-- CreateIndex
CREATE INDEX "ItemBatch_organizationId_itemId_idx" ON "ItemBatch"("organizationId", "itemId");

-- CreateIndex
CREATE INDEX "ItemBatch_organizationId_expiryDate_idx" ON "ItemBatch"("organizationId", "expiryDate");

-- CreateIndex
CREATE INDEX "ItemBatch_organizationId_status_idx" ON "ItemBatch"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ItemBatch_warehouseId_idx" ON "ItemBatch"("warehouseId");

-- CreateIndex
CREATE INDEX "ItemBatch_itemId_idx" ON "ItemBatch"("itemId");

-- CreateIndex
CREATE INDEX "ItemBatch_variantId_idx" ON "ItemBatch"("variantId");

-- CreateIndex
CREATE INDEX "ItemBatch_binId_idx" ON "ItemBatch"("binId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemBatch_organizationId_itemId_batchNumber_key" ON "ItemBatch"("organizationId", "itemId", "batchNumber");

-- CreateIndex
CREATE INDEX "CountZone_organizationId_countId_idx" ON "CountZone"("organizationId", "countId");

-- CreateIndex
CREATE INDEX "CountZone_countId_isArchived_idx" ON "CountZone"("countId", "isArchived");

-- CreateIndex
CREATE INDEX "CountZone_warehouseId_idx" ON "CountZone"("warehouseId");

-- CreateIndex
CREATE INDEX "CountZone_parentZoneId_idx" ON "CountZone"("parentZoneId");

-- CreateIndex
CREATE INDEX "CountZone_createdByUserId_idx" ON "CountZone"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CountZone_countId_code_key" ON "CountZone"("countId", "code");

-- CreateIndex
CREATE INDEX "ZoneLabel_zoneId_idx" ON "ZoneLabel"("zoneId");

-- CreateIndex
CREATE INDEX "ZoneLabel_templateId_idx" ON "ZoneLabel"("templateId");

-- CreateIndex
CREATE INDEX "ZoneLabel_printedByUserId_idx" ON "ZoneLabel"("printedByUserId");

-- CreateIndex
CREATE INDEX "MigrationJob_organizationId_status_idx" ON "MigrationJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MigrationJob_organizationId_createdAt_idx" ON "MigrationJob"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MigrationJob_createdByUserId_idx" ON "MigrationJob"("createdByUserId");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_organizationId_entityType_idx" ON "CustomFieldDefinition"("organizationId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_entityType_fieldKey_key" ON "CustomFieldDefinition"("organizationId", "entityType", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_externalSource_externa_key" ON "CustomFieldDefinition"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "ItemCustomFieldValue_definitionId_idx" ON "ItemCustomFieldValue"("definitionId");

-- CreateIndex
CREATE INDEX "ItemCustomFieldValue_itemId_idx" ON "ItemCustomFieldValue"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCustomFieldValue_itemId_definitionId_key" ON "ItemCustomFieldValue"("itemId", "definitionId");

-- CreateIndex
CREATE INDEX "CronRun_name_idx" ON "CronRun"("name");

-- CreateIndex
CREATE INDEX "CronRun_startedAt_idx" ON "CronRun"("startedAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_locationLevelId_fkey" FOREIGN KEY ("locationLevelId") REFERENCES "LocationLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toBinId_fkey" FOREIGN KEY ("toBinId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "ReasonCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serialNumberId_fkey" FOREIGN KEY ("serialNumberId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostAllocation" ADD CONSTRAINT "LandedCostAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostAllocation" ADD CONSTRAINT "LandedCostAllocation_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostAllocation" ADD CONSTRAINT "LandedCostAllocation_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostAllocation" ADD CONSTRAINT "LandedCostAllocation_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountSnapshot" ADD CONSTRAINT "CountSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountSnapshot" ADD CONSTRAINT "CountSnapshot_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountSnapshot" ADD CONSTRAINT "CountSnapshot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountSnapshot" ADD CONSTRAINT "CountSnapshot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_countedByUserId_fkey" FOREIGN KEY ("countedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CountZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "ReasonCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_serialNumberId_fkey" FOREIGN KEY ("serialNumberId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_countId_itemId_warehouseId_fkey" FOREIGN KEY ("countId", "itemId", "warehouseId") REFERENCES "CountSnapshot"("countId", "itemId", "warehouseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryEvent" ADD CONSTRAINT "WebhookDeliveryEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorAuth" ADD CONSTRAINT "TwoFactorAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountAssignment" ADD CONSTRAINT "CountAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountAssignment" ADD CONSTRAINT "CountAssignment_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountAssignment" ADD CONSTRAINT "CountAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountAssignment" ADD CONSTRAINT "CountAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountApproval" ADD CONSTRAINT "CountApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountApproval" ADD CONSTRAINT "CountApproval_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountApproval" ADD CONSTRAINT "CountApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountApproval" ADD CONSTRAINT "CountApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountTemplate" ADD CONSTRAINT "CountTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountTemplate" ADD CONSTRAINT "CountTemplate_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountTemplate" ADD CONSTRAINT "CountTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelTemplate" ADD CONSTRAINT "LabelTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportTemplate" ADD CONSTRAINT "ImportTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationFieldMapping" ADD CONSTRAINT "IntegrationFieldMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncRule" ADD CONSTRAINT "IntegrationSyncRule_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookEvent" ADD CONSTRAINT "IntegrationWebhookEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncSchedule" ADD CONSTRAINT "IntegrationSyncSchedule_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationTask" ADD CONSTRAINT "IntegrationTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasonCode" ADD CONSTRAINT "ReasonCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialHistory" ADD CONSTRAINT "SerialHistory_serialNumberId_fkey" FOREIGN KEY ("serialNumberId") REFERENCES "SerialNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialHistory" ADD CONSTRAINT "SerialHistory_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialHistory" ADD CONSTRAINT "SerialHistory_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialHistory" ADD CONSTRAINT "SerialHistory_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttachment" ADD CONSTRAINT "ItemAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttachment" ADD CONSTRAINT "ItemAttachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttachment" ADD CONSTRAINT "ItemAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationLevel" ADD CONSTRAINT "LocationLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationLevel" ADD CONSTRAINT "LocationLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationLevel" ADD CONSTRAINT "LocationLevel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LocationLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_shippedByUserId_fkey" FOREIGN KEY ("shippedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_serialNumberId_fkey" FOREIGN KEY ("serialNumberId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitComponent" ADD CONSTRAINT "KitComponent_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickTask" ADD CONSTRAINT "PickTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOptionGroup" ADD CONSTRAINT "ItemOptionGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOptionGroup" ADD CONSTRAINT "ItemOptionGroup_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOptionValue" ADD CONSTRAINT "ItemOptionValue_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "ItemOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVariant" ADD CONSTRAINT "ItemVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVariant" ADD CONSTRAINT "ItemVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVariantOption" ADD CONSTRAINT "ItemVariantOption_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVariantOption" ADD CONSTRAINT "ItemVariantOption_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "ItemOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBarcode" ADD CONSTRAINT "ItemBarcode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBarcode" ADD CONSTRAINT "ItemBarcode_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBarcode" ADD CONSTRAINT "ItemBarcode_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStockLevel" ADD CONSTRAINT "VariantStockLevel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStockLevel" ADD CONSTRAINT "VariantStockLevel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStockLevel" ADD CONSTRAINT "VariantStockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStockMovement" ADD CONSTRAINT "VariantStockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStockMovement" ADD CONSTRAINT "VariantStockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetHistory" ADD CONSTRAINT "AssetHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetHistory" ADD CONSTRAINT "AssetHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBatch" ADD CONSTRAINT "ItemBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBatch" ADD CONSTRAINT "ItemBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBatch" ADD CONSTRAINT "ItemBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountZone" ADD CONSTRAINT "CountZone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountZone" ADD CONSTRAINT "CountZone_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountZone" ADD CONSTRAINT "CountZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountZone" ADD CONSTRAINT "CountZone_parentZoneId_fkey" FOREIGN KEY ("parentZoneId") REFERENCES "CountZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountZone" ADD CONSTRAINT "CountZone_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneLabel" ADD CONSTRAINT "ZoneLabel_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CountZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneLabel" ADD CONSTRAINT "ZoneLabel_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LabelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneLabel" ADD CONSTRAINT "ZoneLabel_printedByUserId_fkey" FOREIGN KEY ("printedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCustomFieldValue" ADD CONSTRAINT "ItemCustomFieldValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCustomFieldValue" ADD CONSTRAINT "ItemCustomFieldValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

