# CIO Annemasse Coffee — version améliorée

Cette version conserve le design néon actuel et ajoute :

- Livraison ou sur place
- Adresse obligatoire seulement pour la livraison
- Récupération automatique du nom, ID et @ Telegram
- Numéro et suivi de commande
- Bouton vers @cioswiss
- Variantes / grammages / prix
- Plusieurs photos et vidéos par produit
- Administration : produits, commandes, clients, comptabilité
- Statuts de commande
- Enregistrement dans Google Sheets

## 1. GitHub

Remplacez les fichiers actuels du dépôt par :
- `index.html`
- `styles.css`
- `app.js`
- les images fournies

## 2. Apps Script

Remplacez entièrement le contenu de `Code.gs` par le nouveau fichier.

Dans **Paramètres du projet → Propriétés du script**, ajoutez :

- `SHEET_ID` : ID du Google Sheet
- `ADMIN_KEY` : votre code secret admin
- `BOT_TOKEN` : token BotFather
- `ADMIN_CHAT_ID` : 8878140883
- `CONTACT_USERNAME` : cioswiss

Puis : **Déployer → Gérer les déploiements → modifier → Nouvelle version → Déployer**.

## 3. Google Sheets

Les feuilles suivantes seront créées automatiquement :
- Produits
- Commandes
- Clients
- Dépenses

La feuille Produits aura automatiquement les colonnes :
`id, nom, categorie, prix, image, description, disponible, images, videos, variants`

Exemple de `variants` :
```json
[{"label":"1 g","price":10,"stock":20},{"label":"3.5 g","price":30,"stock":10}]
```

Exemple de `images` :
`photo1.jpeg|photo2.jpeg|https://exemple.com/photo3.jpg`

Exemple de `videos` :
`https://exemple.com/video1.mp4|https://exemple.com/video2.mp4`

## Important

Le bouton Admin est affiché pour l’ID Telegram configuré dans `app.js`. Le code admin reste demandé avant les modifications. Pour une sécurité maximale, une prochaine étape devrait valider cryptographiquement `Telegram.WebApp.initData` côté serveur.
