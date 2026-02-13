
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize Auth
  setupAuth(app);

  // === Products API ===

  // List products (Protected)
  app.get(api.products.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const products = await storage.getProductsByUserId(req.user!.id);
    res.json(products);
  });

  // Create product (Protected)
  app.post(api.products.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const input = api.products.create.input.parse(req.body);
      const uuid = randomUUID(); // Generate unique public ID
      const product = await storage.createProduct(req.user!.id, { ...input, uuid });
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Update product (Protected)
  app.patch(api.products.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updated = await storage.updateProduct(id, req.body);
    res.json(updated);
  });

  // Delete product (Protected)
  app.delete(api.products.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    const existing = await storage.getProduct(id);
    
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ message: "Product not found" });
    }

    await storage.deleteProduct(id);
    res.sendStatus(200);
  });

  // Public Item View
  app.get(api.products.getByUuid.path, async (req, res) => {
    const uuid = req.params.uuid;
    const product = await storage.getProductByUuid(uuid);

    if (!product) {
      return res.status(404).json({ message: "Item not found" });
    }

    const owner = await storage.getUser(product.userId);
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    // Return restricted info
    res.json({
      product,
      ownerWhatsapp: owner.whatsapp,
    });
  });

  return httpServer;
}
