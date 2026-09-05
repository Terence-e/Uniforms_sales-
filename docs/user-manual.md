# Fondation Révélation Sainte Thérèse

## User Manual — School Uniform Sales & Stock — Phase 1

_How each user performs their tasks · English (Français ci-dessous)_


## About this manual

This manual explains what the School Uniform Sales & Stock system does and, step by step, how each user performs their tasks. It covers Phase 1 — uniform production, sales, orders, alterations, returns and reporting. Read the section for your role plus the shared sections (Getting started, Key rules, Reporting a problem). The French version follows the English one.

> **Note:** The interface is bilingual. Switch language any time from the top bar; every screen and receipt is available in both. What you type — names, notes, reasons — is kept exactly as written and never translated.


## The system at a glance

Uniforms are made and sold in the same place. The system records production as garments are finished, records sales and prints receipts, takes orders for garments not yet made, tracks alterations, handles returns and exchanges, and produces the end-of-day cash reconciliation.


### Rules everyone must know

- Nothing is ever edited or deleted — a mistake is corrected with a new, linked entry (a cancellation, a return); both stay visible.
- Everything is audited: who did what, and when.
- Payment is in full, on the spot — cash or mobile money, no instalments.
- Size is chosen at the moment of sale/order/exchange; stock is counted per size.
- Mobile-first: large buttons, searchable lists, minimal typing.


---


## Getting started (all users)


### Sign in

1. Open the app in a browser. There is no public sign-up — the Super Admin creates your account.
2. Enter your email and password, then select Login.
3. On your first login, set a new password (at least 8 characters, with a letter and a number) before continuing.

If your account is deactivated you cannot sign in — contact your administrator. Forgotten passwords are reset by the Super Admin (no email self-service). You are signed out after inactivity: 12 hours for the Seller, 2 hours for everyone else.


### Find your way around

1. Use the sidebar to move between screens (grouped Overview, Operations, Records, Administration) — you only see what your role allows.
2. Use the search box to find a transaction by reference number, student name, parent name or phone.
3. Open the bell for notifications; use the language and theme toggles in the top bar.


---


## Roles at a glance

| Role | Who | What they do |
| --- | --- | --- |
| Seller | Mr. Ateba (1) | Production, sales, orders, alterations, returns, exchanges, cancellations. Cannot change prices. |
| Administration | Founder, admin staff (~5) | Read-only everywhere: views, reports, exports, audit log. No writing. |
| Maintenance | Developers (2) | Full functional access, fully audited. |
| Super Admin | 1 | Accounts, catalogue and prices, size set, return policy windows. |


---


## The Seller

The Seller (Mr. Ateba) runs the shop. The landing screen is Open jobs.


### Read the Open jobs list

1. Open the app — Open jobs is your home screen.
2. Read each card: student and class, garment and size, status, date placed, and days open. Oldest is at the top.
3. Tap a card to change its status in one tap, or to open the job.


### Record a sale

1. Open Sales.
2. Type the student name and class, and the parent name (phone optional).
3. Tap Add item, choose the product, then tap the size on the size bar (or type a custom size), and set the quantity. Repeat for more items.
4. To reduce a price, enter an amount in Discount and a reason (the unit price itself cannot be edited).
5. Choose the payment method — Cash, MoMo or Orange Money — and, for mobile money, the transaction reference.
6. For cash, optionally enter the amount tendered to see the change.
7. Select Save. The receipt opens and stock for that product/size goes down.

> **Note:** Selling more than the system shows warns you but does not block the sale; confirm to proceed and the override is recorded.


### Print or reprint a receipt

1. After saving, the receipt opens — choose A5 or A4 and select Print.
2. To reprint later, open the sale (via search or the sales list) and select Reprint. The copy is stamped DUPLICATA / DUPLICATE and is recorded.


### Take an order (garment not available yet)

1. Open Orders and enter the customer and line(s) with size, as for a sale.
2. Take payment in full — the receipt is marked COMMANDE / ORDER.
3. The order appears in Open jobs; advance it Ordered → In production → Ready as the garment is made.
4. When the parent comes, open the order and record the collection: a collection slip prints (showing the COL and the ORD it closes) and stock is reduced at that point.


### Take in an alteration

1. Open Alterations → New.
2. Record the parent/student, the garment, and what must be done (required).
3. Set whether there is a charge; if so, take payment and method.
4. Give the parent the printed deposit slip.
5. Advance it Received → In progress → Ready, and record Returned when the parent collects. Alterations never touch stock.


### Handle a return or exchange

1. Open the original sale and select Start return (or Returns → New).
2. Read the on-screen verdict — how long ago the sale was and whether an exchange/refund is within policy.
3. Choose the garment(s) coming back and declare the condition (Unworn or Worn).
4. For an exchange, pick the replacement product and size; collect the difference if dearer, refund it if cheaper. For a return, issue the refund and record its method.
5. Enter a reason (required). If outside policy, add the reason it asks for and proceed — the override is flagged in reports.
6. Select Save — a return/exchange receipt prints and stock updates both ways.


### Cancel a sale

1. Open the sale and select Cancel.
2. Enter a reason (required) and confirm.
3. Stock is put back; the sale stays visible marked Cancelled, keeps its reference, and is excluded from revenue.


### Record production

1. Open Stock → Record production.
2. Add a line: choose the product, tap the size, enter the quantity made. Add more lines for other sizes in the same batch.
3. Optionally add the tailor’s name, then Save. Stock rises from these entries — it is never typed in directly.


### Adjust stock

1. On the Stock screen, find the product/size whose count is wrong and select Adjust.
2. Choose Add or Remove, enter the amount and a reason (required), and Save. The difference is recorded as a movement; the count is not overwritten.

The Seller cannot change prices, manage accounts, or configure sizes and policies — those belong to the Super Admin.


---


## Administration

Administration accounts are strictly read-only: they can open and read everything but change nothing (enforced on the server, not just by hiding buttons).


### What you can do

1. Open any screen from the sidebar to read it — Open jobs, sales, orders, alterations, returns, collections.
2. Open Reports for the daily reconciliation and every other report, and export to Excel or PDF.
3. Open the Audit log to see every recorded action.

Attempting to record a sale, change a price or alter any record is refused.


## Maintenance (developers)

Maintenance accounts have full functional access to help run the shop and fix problems, and every action is audited like anyone else. Maintenance also reads and works through the support messages and bug reports.


---


## Super Admin


### Manage accounts

1. Open Accounts.
2. Create an account: enter name, email and role; share the generated temporary password securely (the user changes it at first login).
3. Reset password: issue a new temporary password for a locked-out user.
4. Deactivate: stop a user signing in while keeping their name on their past work (this is how you retire someone).
5. Activate: re-enable a deactivated user.
6. Delete: only for an account with no activity on record; anything with history must be deactivated instead. You cannot act on your own account.


### Manage the catalogue and prices

1. Open Catalogue.
2. New product: enter the garment name and price (no size — size is chosen at sale). Save.
3. Change a price by editing the product — the change is audited (old and new value) and is not retroactive; past sales keep their price.
4. Archive a product to remove it from the sale screen while keeping it in past records (products are archived, never deleted).


### Configure the size set

1. Open Settings → Sizes.
2. Choose Letters (type a list such as S, M, L, XL) or Numbers (set a range, e.g. 20 to 46, step 2).
3. Check the live preview — those are the exact boxes the Seller will see — and Save.


### Set the return-policy windows

1. Open Settings.
2. Set the four windows (exchange/refund × unworn/worn). Save.
3. Changing a window never reclassifies past returns — each keeps the verdict it was given.


---


## Reports and exports (all roles)

All reports are available to every role. Each export is stamped with the date, who generated it and the filters, and is recorded.


### Produce a report or export

1. Open Reports.
2. For the end of day, read the Daily cash reconciliation: net cash that should be in the box (cash only) is shown separately from the mobile-money total to check against the phone.
3. For other reports, pick the report and date range: sales by period, by garment and size, production, orders and turnaround, returns and exchanges, cancellations, audit log.
4. Select Export Excel, or Print / Save as PDF.


## Reporting a problem

1. On any screen, select Report a problem in the sidebar.
2. Describe what happened; optionally attach a screenshot. It captures the page, your account and browser automatically.
3. Submit — Maintenance and the Super Admin are notified at once. If the app itself is down, phone the first responder instead.


---


## Quick reference

| Prefix | Document |
| --- | --- |
| SAL | Sale |
| ORD | Order (garment to follow) |
| COL | Collection of an order |
| ALT | Alteration (deposit slip) |
| RTN | Return or exchange |

References are sequential and never reused within their type and year (e.g. SAL-2026-0001). A cancelled document keeps its number.

- You cannot break the records by making a mistake — corrections are new, linked entries.
- No paper? Search by parent name or phone.
- System and shelf disagree? Trust the shelf, confirm the override, and record production/adjustments so counts catch up.


---

# Fondation Révélation Sainte Thérèse

## Manuel d’utilisation — Vente et stock d’uniformes scolaires — Phase 1

_Comment chaque utilisateur effectue ses tâches · Français_


## À propos de ce manuel

Ce manuel explique ce que fait le système de vente et de stock d’uniformes scolaires et, étape par étape, comment chaque utilisateur effectue ses tâches. Il couvre la Phase 1 — production, ventes, commandes, retouches, retours et rapports. Lisez la section de votre rôle et les sections communes (Premiers pas, Règles essentielles, Signaler un problème).

> **Note:** L’interface est bilingue. Changez de langue à tout moment depuis la barre du haut ; chaque écran et chaque reçu existe dans les deux langues. Ce que vous saisissez — noms, notes, motifs — est conservé tel quel et jamais traduit.


## Le système en bref

Les uniformes sont fabriqués et vendus au même endroit. Le système enregistre la production au fur et à mesure, enregistre les ventes et imprime les reçus, prend des commandes pour les articles non encore faits, suit les retouches, gère les retours et échanges, et produit le rapprochement de caisse de fin de journée.


### Règles que chacun doit connaître

- On ne modifie ni ne supprime jamais rien — une erreur se corrige par une nouvelle écriture liée (une annulation, un retour) ; les deux restent visibles.
- Tout est audité : qui a fait quoi, et quand.
- Le paiement est intégral, sur place — espèces ou mobile money, sans échelonnement.
- La taille est choisie au moment de la vente/commande/échange ; le stock est compté par taille.
- Pensé pour le mobile : grands boutons, listes cherchables, peu de saisie.


---


## Premiers pas (tous les utilisateurs)


### Se connecter

1. Ouvrez l’application dans un navigateur. Aucune inscription publique — le Super Admin crée votre compte.
2. Saisissez votre e-mail et votre mot de passe, puis Se connecter.
3. À la première connexion, définissez un nouveau mot de passe (au moins 8 caractères, avec une lettre et un chiffre) avant de continuer.

Si votre compte est désactivé, vous ne pouvez pas vous connecter — contactez votre administrateur. Les mots de passe oubliés sont réinitialisés par le Super Admin (pas de service par e-mail). Vous êtes déconnecté après inactivité : 12 heures pour le Vendeur, 2 heures pour les autres.


### Se repérer

1. Utilisez la barre latérale pour naviguer (Vue d’ensemble, Opérations, Registres, Administration) — vous ne voyez que ce que votre rôle permet.
2. Utilisez la recherche pour trouver une transaction par numéro de référence, nom de l’élève, nom du parent ou téléphone.
3. Ouvrez la cloche pour les notifications ; utilisez les boutons de langue et de thème en haut.


---


## Les rôles en un coup d’œil

| Rôle | Qui | Ce qu’ils font |
| --- | --- | --- |
| Vendeur | M. Ateba (1) | Production, ventes, commandes, retouches, retours, échanges, annulations. Ne peut pas changer les prix. |
| Administration | Fondateur, personnel (~5) | Lecture seule partout : vues, rapports, exports, journal d’audit. Aucune écriture. |
| Maintenance | Développeurs (2) | Accès fonctionnel complet, entièrement audité. |
| Super Admin | 1 | Comptes, catalogue et prix, jeu de tailles, délais de la politique de retour. |


---


## Le Vendeur

Le Vendeur (M. Ateba) tient la boutique. L’écran d’accueil est Travaux en cours.


### Lire la liste des travaux en cours

1. Ouvrez l’application — Travaux en cours est votre écran d’accueil.
2. Lisez chaque carte : élève et classe, article et taille, statut, date, et nombre de jours ouverts. Le plus ancien est en haut.
3. Touchez une carte pour changer son statut en un geste, ou pour l’ouvrir.


### Enregistrer une vente

1. Ouvrez Ventes.
2. Saisissez le nom et la classe de l’élève, et le nom du parent (téléphone facultatif).
3. Touchez Ajouter un article, choisissez le produit, puis touchez la taille sur la barre de tailles (ou saisissez une taille personnalisée) et indiquez la quantité. Répétez pour d’autres articles.
4. Pour réduire un prix, saisissez un montant dans Remise avec un motif (le prix unitaire ne se modifie pas).
5. Choisissez le mode de paiement — Espèces, MoMo ou Orange Money — et, pour le mobile money, la référence de la transaction.
6. Pour les espèces, saisissez éventuellement le montant remis pour voir la monnaie.
7. Sélectionnez Enregistrer. Le reçu s’ouvre et le stock de ce produit/taille diminue.

> **Note:** Vendre plus que ce qu’affiche le système vous avertit mais ne bloque pas la vente ; confirmez pour continuer et la dérogation est enregistrée.


### Imprimer ou réimprimer un reçu

1. Après l’enregistrement, le reçu s’ouvre — choisissez A5 ou A4 et Imprimer.
2. Pour réimprimer plus tard, ouvrez la vente (par la recherche ou la liste) et sélectionnez Réimprimer. La copie porte la mention DUPLICATA / DUPLICATE et est enregistrée.


### Prendre une commande (article non disponible)

1. Ouvrez Commandes et saisissez le client et la ou les lignes avec la taille, comme pour une vente.
2. Encaissez le paiement intégral — le reçu porte la mention COMMANDE / ORDER.
3. La commande apparaît dans Travaux en cours ; faites-la avancer Commandée → En production → Prête.
4. À la venue du parent, ouvrez la commande et enregistrez le retrait : un bon de retrait s’imprime (indiquant le COL et le ORD qu’il clôt) et le stock diminue à ce moment.


### Réceptionner une retouche

1. Ouvrez Retouches → Nouvelle.
2. Enregistrez le parent/l’élève, l’article et ce qui doit être fait (obligatoire).
3. Indiquez s’il y a des frais ; si oui, encaissez et indiquez le mode.
4. Remettez au parent le bon de dépôt imprimé.
5. Faites avancer Reçue → En cours → Prête, et enregistrez Rendue au retrait. Les retouches ne touchent jamais au stock.


### Traiter un retour ou un échange

1. Ouvrez la vente d’origine et sélectionnez Démarrer un retour (ou Retours → Nouveau).
2. Lisez le verdict à l’écran — depuis combien de temps la vente a eu lieu et si l’échange/remboursement est dans les délais.
3. Choisissez le ou les articles rendus et déclarez l’état (Non porté ou Porté).
4. Pour un échange, choisissez le produit et la taille de remplacement ; encaissez la différence si plus cher, remboursez-la si moins cher. Pour un retour, effectuez le remboursement et indiquez son mode.
5. Saisissez un motif (obligatoire). Hors délais, ajoutez le motif demandé et continuez — la dérogation est signalée dans les rapports.
6. Enregistrez — un reçu de retour/échange s’imprime et le stock est mis à jour dans les deux sens.


### Annuler une vente

1. Ouvrez la vente et sélectionnez Annuler.
2. Saisissez un motif (obligatoire) et confirmez.
3. Le stock est restitué ; la vente reste visible avec la mention Annulée, garde sa référence et est exclue du chiffre d’affaires.


### Enregistrer la production

1. Ouvrez Stock → Enregistrer la production.
2. Ajoutez une ligne : choisissez le produit, touchez la taille, saisissez la quantité fabriquée. Ajoutez d’autres lignes pour d’autres tailles dans le même lot.
3. Ajoutez éventuellement le nom du tailleur, puis Enregistrez. Le stock monte à partir de ces écritures — il ne se saisit jamais directement.


### Ajuster le stock

1. Sur l’écran Stock, trouvez le produit/taille dont le compte est faux et sélectionnez Ajuster.
2. Choisissez Ajouter ou Retirer, saisissez la quantité et un motif (obligatoire), puis Enregistrez. La différence est enregistrée comme mouvement ; le compte n’est pas écrasé.

Le Vendeur ne peut pas changer les prix, gérer les comptes, ni configurer les tailles et politiques — cela revient au Super Admin.


---


## Administration

Les comptes Administration sont en lecture seule stricte : ils peuvent tout ouvrir et lire mais ne rien changer (imposé côté serveur, pas seulement en masquant des boutons).


### Ce que vous pouvez faire

1. Ouvrez n’importe quel écran depuis la barre latérale pour le consulter — Travaux en cours, ventes, commandes, retouches, retours, retraits.
2. Ouvrez Rapports pour le rapprochement quotidien et tous les autres rapports, et exportez en Excel ou PDF.
3. Ouvrez le Journal d’audit pour voir chaque action enregistrée.

Toute tentative d’enregistrer une vente, de changer un prix ou de modifier un enregistrement est refusée.


## Maintenance (développeurs)

Les comptes Maintenance ont un accès fonctionnel complet pour aider à faire tourner la boutique et corriger les problèmes, et chaque action est audité comme pour tout le monde. La Maintenance lit aussi et traite les messages d’assistance et les rapports de bug.


---


## Super Admin


### Gérer les comptes

1. Ouvrez Comptes.
2. Créer un compte : saisissez le nom, l’e-mail et le rôle ; partagez le mot de passe temporaire généré de façon sécurisée (l’utilisateur le change à la première connexion).
3. Réinitialiser le mot de passe : émettez un nouveau mot de passe temporaire.
4. Désactiver : empêchez un utilisateur de se connecter tout en gardant son nom sur ses travaux passés (c’est ainsi qu’on retire quelqu’un).
5. Activer : réactivez un utilisateur désactivé.
6. Supprimer : seulement pour un compte sans activité enregistrée ; tout ce qui a un historique doit être désactivé. Vous ne pouvez pas agir sur votre propre compte.


### Gérer le catalogue et les prix

1. Ouvrez Catalogue.
2. Nouveau produit : saisissez le nom de l’article et le prix (pas de taille — elle est choisie à la vente). Enregistrez.
3. Changez un prix en modifiant le produit — le changement est audité (ancien et nouveau) et non rétroactif ; les ventes passées gardent leur prix.
4. Archivez un produit pour le retirer de l’écran de vente tout en le gardant dans les registres (les produits sont archivés, jamais supprimés).


### Configurer le jeu de tailles

1. Ouvrez Paramètres → Tailles.
2. Choisissez Lettres (saisissez une liste comme S, M, L, XL) ou Chiffres (définissez une plage, p. ex. 20 à 46, pas de 2).
3. Vérifiez l’aperçu en direct — ce sont exactement les cases que verra le Vendeur — et Enregistrez.


### Définir les délais de retour

1. Ouvrez Paramètres.
2. Définissez les quatre délais (échange/remboursement × non porté/porté). Enregistrez.
3. Modifier un délai ne reclasse jamais les retours passés — chacun garde son verdict.


---


## Rapports et exports (tous les rôles)

Tous les rapports sont accessibles à chaque rôle. Chaque export porte la date, l’auteur et les filtres, et est enregistré.


### Produire un rapport ou un export

1. Ouvrez Rapports.
2. Pour la fin de journée, lisez le Rapprochement de caisse : l’argent liquide qui doit être en caisse (espèces uniquement) est affiché à part du total mobile money à vérifier sur le téléphone.
3. Pour les autres rapports, choisissez le rapport et la période : ventes par période, par article et taille, production, commandes et délais, retours et échanges, annulations, journal d’audit.
4. Sélectionnez Exporter Excel, ou Imprimer / Enregistrer en PDF.


## Signaler un problème

1. Sur n’importe quel écran, sélectionnez Signaler un problème dans la barre latérale.
2. Décrivez ce qui s’est passé ; joignez éventuellement une capture. Le système capte la page, votre compte et le navigateur automatiquement.
3. Envoyez — la Maintenance et le Super Admin sont notifiés aussitôt. Si l’application est hors service, appelez le premier intervenant.


---


## Référence rapide

| Préfixe | Document |
| --- | --- |
| SAL | Vente |
| ORD | Commande (article à suivre) |
| COL | Retrait d’une commande |
| ALT | Retouche (bon de dépôt) |
| RTN | Retour ou échange |

Les références sont séquentielles et jamais réutilisées dans leur type et leur année (p. ex. SAL-2026-0001). Un document annulé garde son numéro.

- Vous ne pouvez pas casser les registres en faisant une erreur — les corrections sont de nouvelles écritures liées.
- Pas de papier ? Cherchez par nom du parent ou téléphone.
- Le système et l’étagère divergent ? Faites confiance à l’étagère, confirmez la dérogation, et enregistrez production/ajustements pour que les comptes se rattrapent.

