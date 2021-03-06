const authMiddleware = require('../../middleware/auth');
const uploadAvatarAdmin = require('../../middleware/uploadAvatarAdmin');

const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Admin = require('../../model/Admin');
const Brand = require('../../model/Brand');
const GroupProduct = require('../../model/GroupProduct');
const User = require('../../model/User');
const Post = require('../../model/Post');

const ObjectId = mongoose.Types.ObjectId;

const formatQuery = require('../../helper/formatQuery');
const get_params_or_query_limit = require('../../helper/get_params_or_query_limit');
const HelperValidate = require('../../helper/validate');
const hashPassOrCheck = require('../../helper/hashPassOrCheck');
const checkMagicNumbersImage = require('../../helper/CheackMagicNumberImage');
const uploadBrandImage = require('../../middleware/uploadBrandImage');
const regexHelper = require('../../helper/Regex');
const uploadImage = require('../../middleware/uploadImage');
const uploadDisplayImageProduct = require('../../middleware/uploadDisplayImageProduct');
const uploadPost = require('../../middleware/uploadPost');
const { v4: uuid } = require('uuid');
const FormatUrlToEn = require('../../helper/FormatUrlToEN');
const uploadImageCreateProductMiddleware = require('../../middleware/uploadImageCreateProduct');
const { isObject } = require('../../helper/jsonHelper');
// router.get("/api/admin/profile", authMiddleware.verifyTokenAdmin, async (req, res) => {
// 	try {
// 		const id = req.query.Id || req.body.Id;

// 		const adminProfile = await Admin.findById(id);

// 		if (adminProfile) {
// 			return res.json({
// 				DisplayName: adminProfile.DisplayName,
// 				Avatar: adminProfile.Avatar,
// 				UserName: adminProfile.UserName,
// 			});
// 		}
// 		return res.status(400).json({});
// 	} catch (error) {
// 		if (error) res.status(500).json({ error: 500, message: "server error" });
// 	}
// });

const getSortUer = sort => {
	if (sort == 'AZ') {
		return { Name: 1 };
	}
	if (sort == 'ZA') {
		return { Name: -1 };
	}
	if (sort == 'createdUp') {
		return { createdAt: 1 };
	}
	if (sort == 'createdDown') {
		return { createdAt: -1 };
	}
	// default
	return {
		Name: 1,
	};
};
const getUsers = async (res, query, page, limit, skip, sort) => {
	try {
		const queryFormated = formatQuery(query);
		const users = await User.aggregate([
			{
				$match: {
					$or: [
						{
							Name: {
								$regex: `${queryFormated}`,
								$options: 'i',
							},
						},
						{
							PhoneNumber: {
								$regex: `${queryFormated}`,
								$options: 'i',
							},
						},
					],
				},
			},
			{ $sort: sort },
			{
				$facet: {
					data: [
						{ $skip: skip },
						{ $limit: limit },
						{
							$project: {
								Name: 1,
								PhoneNumber: 1,
								Avatar: 1,
								createdAt: 1,
								Address: 1,
							},
						},
					],
					metaData: [
						{
							$group: {
								_id: null,
								countUsers: { $sum: 1 },
							},
						},
						{
							$addFields: {
								limit,
								skip,
								page,
							},
						},
						{
							$project: {
								countUsers: 1,
								limit: 1,
								skip: 1,
								page: 1,
							},
						},
					],
				},
			},
		]);

		res.status(200).json(users);
	} catch (error) {
		res.status(500).json({ error: 500, message: 'server error' });
	}
};
router.get('/api/admin/getusers', authMiddleware.verifyTokenAdmin, async (req, res) => {
	const query = req.query.query || '^';
	const page = get_params_or_query_limit(req.query.page);
	const limit = get_params_or_query_limit(req.query.limit);
	const skip = (page - 1) * limit;
	const sort = getSortUer(req.query.sort);
	getUsers(res, query, page, limit, skip, sort);
});
router.post('/api/admin/deleteuser', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const _idUser = req.body._id;
		if (!_idUser || _idUser == '') {
			return res.status(400).json({
				error: 400,
				message: 'Thi???u tr?????ng _id',
			});
		}
		User.findByIdAndDelete(_idUser, {}, err => {
			if (err) {
				return res.status(400).json({
					error: 400,
					message: 'Kh??ng t??m th???y user',
				});
			}
			return res.status(200).json({ _id: _idUser });
		});
	} catch (error) {
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
router.post('/api/admin/edituser', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_User = req.body._id;
		if (!Id_User || Id_User == '') {
			return res.status(400).json({
				error: 400,
				message: 'Thi???u tr?????ng _id',
			});
		}

		const editObj = (() => {
			const obj = {
				Name: req.body.Name.trim(),
				PhoneNumber: req.body.PhoneNumber.trim(),
			};
			if (req.body.Address) {
				obj.Address = req.body.Address;
			}
			if (req.body.Password && req.body.Password.trim().length !== 0) {
				obj.Password = req.body.Password.trim();
			}
			return obj;
		})();
		const { error } = await HelperValidate.editUser(editObj);
		if (error) {
			return res.status(400).json({
				error: 400,
				message: 'Vui l??ng ki???m tra l???i th??ng tin!',
			});
		}
		/// c?? th??? s???a m???t kh???u ho???c ko
		// d???a ch??? c??ng v

		const newUpdate = editObj.Password
			? {
					...editObj,
					Password: await hashPassOrCheck.hash(editObj.Password),
			  }
			: editObj;

		const user = await User.findByIdAndUpdate(Id_User, newUpdate, {
			safe: true,
			upsert: true,
			new: true,
		}).select({
			Name: 1,
			PhoneNumber: 1,
			Avatar: 1,
			createdAt: 1,
			Address: 1,
		});
		if (user) {
			return res.status(200).json(user);
		}
		return res.status(400).json({
			error: 400,
			message: 'Vui l??ng ki???m tra l???i th??ng tin!',
		});
	} catch (error) {
		res.status(500).json({ error: 500, message: 'server error' });
	}
});

/// brands

router.get('/api/admin/getbrands', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const data = await Brand.find().select({
			_id: 1,
			BrandName: 1,
			BrandImage: 1,
			createdAt: 1,
		});
		res.status(200).json(data);
	} catch (error) {
		res.status(500).json({
			error: 500,
			message: 'server error',
		});
	}
});
router.post('/api/admin/deletebrand', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const { Id_Brand } = req.body;
		if (!Id_Brand || Id_Brand === '' || !ObjectId.isValid(Id_Brand)) {
			return res.status(400).json({
				error: 400,
				message: 'Tham s??? kh??ng ch??nh x??c',
			});
		}

		const deleteBrand = await Brand.findByIdAndDelete(Id_Brand);
		if (!deleteBrand) {
			// n???u kh??ng delete ??c ||ko kh???p c??i n??o
			return res.status(400).json({
				error: 400,
				message: 'Kh??ng t??m th??y th????ng hi???u',
			});
		}
		const findGroupsProduct = await GroupProduct.aggregate([
			{
				$match: {
					Brand: ObjectId(Id_Brand),
				},
			},
			{
				$project: {
					_id: 1,
					CountProduct: { $size: '$Product' },
					Image: '$Product.Image',
					DisplayImage: '$Product.Information.DisplayImage',
				},
			},
		]);
		// n???u kh??ng t??m th???y s???n ph???m n??o
		if (findGroupsProduct.length === 0) {
			let countImages = 0;
			const pathBrandImage = path.join(`${__dirname}../../../public${deleteBrand.BrandImage}`);
			if (fs.existsSync(pathBrandImage)) {
				fs.unlinkSync(pathBrandImage);
				countImages += 1;
			}
			return res.json({
				CountBrandsDeleted: 1,
				CountProductsDeleted: 0,
				CountGroupsProductDeleted: 0,
				CountImagesDeleted: countImages,
			});
		}
		// n???u tim th??y th??  x??a
		const deleteGroupProductOfBrand = await GroupProduct.deleteMany({
			Brand: ObjectId(Id_Brand),
		});
		// ------
		let countProductDeleted = 0;
		// tr??? v??? m???ng ???????ng d???n h??nh ???nh c???a s???n ph???m
		const arrayImages = findGroupsProduct.reduce((prev, current) => {
			countProductDeleted += current.CountProduct;
			return prev.concat(current.DisplayImage).concat(current.Image.flat(1));
		}, []);
		// tr??? v??? m???ng unique ???????ng d???n h??nh ???nh c???a s???n ph???m
		const uniqueArrayImages = [...new Set(arrayImages), deleteBrand.BrandImage];
		let countImagesDeleted = 0;
		uniqueArrayImages.forEach(image => {
			const pathImage = path.join(`${__dirname}../../../public${image}`);
			if (fs.existsSync(pathImage)) {
				fs.unlinkSync(pathImage);
				countImagesDeleted += 1;
			}
		});
		return res.json({
			CountBrandsDeleted: 1,
			CountProductsDeleted: countProductDeleted,
			CountGroupsProductDeleted: deleteGroupProductOfBrand.deletedCount,
			CountImagesDeleted: countImagesDeleted,
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({
			error: 500,
			message: 'server error',
		});
	}
});
router.post('/api/admin/addbrand', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		await uploadBrandImage(req, res);

		const BrandName = req.body.BrandName?.trim();

		if (!BrandName || BrandName === '' || !regexHelper.checkBrandName(BrandName)) {
			if (req.file) fs.unlink(req.file.path, () => {});
			return res.status(400).json({
				error: 400,
				message: 'T??n th????ng hi???u l?? b???t bu???c',
			});
		}
		if (!req.file) {
			return res.status(400).json({
				error: 400,
				message: '???nh th????ng hi???u l?? b???t bu???c',
			});
		}
		const brandExit = await Brand.findOne({ BrandName });
		const pathBrandImage = path.join(__dirname, '../../public/backend/Brands', req.file.filename);
		if (brandExit) {
			fs.unlink(pathBrandImage, err => {
				if (err) throw err;
			});

			return res.status(400).json({ error: 400, message: 'T??n ???? t???n t???i' });
		}

		const bitmap = fs.readFileSync(pathBrandImage).toString('hex', 0, 4);
		if (checkMagicNumbersImage(bitmap) === false) {
			fs.unlink(pathBrandImage, err => {
				if (err) {
					throw err;
				}
			});
			return res.status(400).json({
				error: 400,
				message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
			});
		}

		const fileType = req.file.mimetype.split('/')[1];
		const newBrandImagePath = `${req.body.BrandName}.${fileType}`;
		sharp(req.file.path)
			.resize(320, 80, { fit: 'cover' })
			.toBuffer((err, buffer) => {
				if (err) throw err;
				fs.writeFile(
					path.join(__dirname, `../../public/backend/Brands/${newBrandImagePath}`),
					buffer,
					e => {
						if (e) throw e;
						fs.unlink(req.file.path, e1 => {
							if (e1) throw e1;
						});
					}
				);
			});
		const newBrand = {
			_id: new ObjectId(),
			BrandImage: `/backend/Brands/${newBrandImagePath}`,
			BrandName,
		};
		Brand.create(newBrand, (err, doc) => {
			if (err) {
				return res.status(500).json({
					error: 500,
					message: 'server error',
				});
			}
			return res.status(200).json({ ...newBrand, createdAt: doc.createdAt });
		});
	} catch (error) {
		if (error.code == 'LIMIT_FILE_SIZE') {
			console.log(error.message);
			return res.status(500).send({
				message: 'File size cannot be larger than 2MB!',
			});
		}
		res.status(500).json({
			// message: `Could not upload the file: ${req.file.originalname}. ${error}`,
			message: '???? x???y ra l???i. Vui l??ng ki???m tra l???i!',
		});
	}
});
router.post('/api/admin/editbrand', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		await uploadBrandImage(req, res);
		const BrandName = req.body.BrandName?.trim();

		if (!BrandName || BrandName === '' || !regexHelper.checkBrandName(BrandName)) {
			return res.status(400).json({
				error: 400,
				message: 'Vui l??ng ki???m tra l???i t??n th????ng hi???u!',
			});
		}
		const Id_Brand = req.body.Id_Brand?.trim();
		const fileImage = req.file?.path;
		// n???u req sai th?? x??a file c??
		if (!Id_Brand || Id_Brand === '' || !ObjectId.isValid(Id_Brand)) {
			if (fileImage) {
				fs.unlink(fileImage, err => {
					if (err) console.log(err);
				});
			}
			return res.status(400).json({
				error: 400,
				message: 'Vui l??ng ki???m tra l???i th??ng tin!',
			});
		}
		return Brand.findById(Id_Brand, { BrandImage: 1, BrandName: 1 }, {}, async (err, doc) => {
			if (err) {
				return res.status(500).json({
					error: 500,
					message: 'server error',
				});
			}
			if (!doc) {
				return res.status(400).json({
					error: 400,
					message: 'Kh??ng c?? th????ng hi???u nh?? v???y trong csdl.',
				});
			}
			if (doc.BrandName === BrandName) {
				return res.status(400).json({
					error: 400,
					message: 'T??n kh??ng ???????c tr??ng v???i t??n ban ?????u',
				});
			}
			if (!fileImage) {
				// khong c?? file name nhung t??n file v???n thay ?????i t??n
				const newBrandImageFileName = `${BrandName}.${regexHelper
					.filenameRegex(doc.BrandImage)
					.split('.')
					.pop()}`;
				doc.BrandName = BrandName;
				const oldFileName = path.join(__dirname, `../../public${doc.BrandImage}`);
				// newu file name m???i
				doc.BrandImage = `/backend/Brands/${newBrandImageFileName}`;

				return doc.save((errSave, docSave) => {
					if (errSave) {
						/// l???i do validator schema
						if (
							errSave.errors?.BrandName?.properties?.message ===
							'T??n th????ng hi???u ???? t???n t???i'
						) {
							return res.status(400).json({
								error: 400,
								message: 'T??n ???? t???n t???i',
							});
						}
						return res.status(500).json({
							error: 500,
							message: 'server error',
						});
					}
					const newFileName = path.join(
						__dirname,
						`../../public/backend/Brands/${newBrandImageFileName}`
					);

					fs.rename(oldFileName, newFileName, () => {});
					return res.json(docSave);
				});
			}

			if (fileImage) {
				const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);
				if (checkMagicNumbersImage(bitmap) === false) {
					fs.unlink(fileImage, er => {
						if (er) {
							throw er;
						}
					});
					return res.status(400).json({
						error: 400,
						message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
					});
				}
				const newBrandImagePath = `${BrandName}.${req.file.mimetype.split('/')[1]}`;
				const oldPath = path.join(__dirname, `../../public${doc.BrandImage}`);
				doc.BrandName = BrandName;
				doc.BrandImage = `/backend/Brands/${newBrandImagePath}`;
				doc.save((errdocSave, docSave) => {
					if (errdocSave) {
						fs.unlink(fileImage, () => {});
						/// l???i do validator schema
						if (
							errdocSave.errors?.BrandName?.properties?.message ===
							'T??n th????ng hi???u ???? t???n t???i'
						) {
							return res.status(400).json({
								error: 400,
								message: 'T??n ???? t???n t???i',
							});
						}
						return res.status(500).json({
							error: 500,
							message: 'server error',
						});
					}

					res.json(docSave);

					sharp(fileImage)
						.resize(300, 80, {
							fit: 'cover',
						})
						.toBuffer((errbuffer, buffer) => {
							if (errbuffer) throw errbuffer;
							fs.writeFile(
								path.join(
									__dirname,
									`../../public/backend/Brands/${newBrandImagePath}`
								),
								buffer,
								e => {
									if (e) throw e;
									fs.unlink(fileImage, e1 => {
										if (e1) throw e1;
									});
									fs.unlink(oldPath, () => {});
								}
							);
						});
				});
			}
		});
	} catch (error) {
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
const getSortGroupProduct = sort => {
	if (sort == 'AZ') {
		return { GroupName: 1 };
	}
	if (sort == 'ZA') {
		return { GroupName: -1 };
	}
	if (sort == 'createdUp') {
		return { createdAt: 1 };
	}
	if (sort == 'createdUp') {
		return { createdAt: -1 };
	}
	// default
	return {
		createdAt: -1,
	};
};
const getGroupProduct = async (res, query, page, limit, skip, sort) => {
	try {
		// const queryFormated = formatQuery(query);
		const data = await GroupProduct.aggregate([
			{
				$lookup: {
					from: 'brands',
					localField: 'Brand',
					foreignField: '_id',
					as: 'brands',
				},
			},
			{ $sort: sort },
			{
				$facet: {
					data: [
						{ $skip: skip },
						{ $limit: limit },
						{
							$project: {
								_id: 1,
								GroupName: 1,
								ProductType: 1,
								Id_Brand: '$Brand',
								BrandName: {
									$first: '$brands.BrandName',
								},
								createdAt: 1,
								CountProduct: {
									$size: '$Product',
								},
							},
						},
					],
					metaData: [
						{
							$group: {
								_id: null,
								total: { $sum: 1 },
							},
						},
						{
							$addFields: {
								limit,
								skip,
								page,
							},
						},
						{
							$project: {
								_id: 0,
								total: 1,
								limit: 1,
								skip: 1,
								page: 1,
							},
						},
					],
				},
			},
		]);
		res.status(200).json(data[0]);
	} catch (error) {
		console.log(error);

		res.status(500).json({ error: 500, message: 'server error' });
	}
};
router.get('/api/admin/getGroupProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const query = req.query.query || '^';
		const page = get_params_or_query_limit(req.query.page);
		const limit = get_params_or_query_limit(req.query.limit);
		const skip = (page - 1) * limit;
		const sort = getSortGroupProduct(req.query.sort);
		getGroupProduct(res, query, page, limit, skip, sort);
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
router.post('/api/admin/addGroupProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const newGroupProduct = {
			GroupName: req.body.GroupName,
			Brand: req.body.Brand,
			ProductType: req.body.ProductType,
			Describe: req.body.Describe,
		};
		const { error: errorValidation } = await HelperValidate.groupProduct(newGroupProduct);
		if (errorValidation) {
			return res.status(400).json({
				message: 'Vui l??ng ki???m tra l???i th??ng tin!',
			});
		}

		const newGroup = new GroupProduct({
			...newGroupProduct,
			Brand: ObjectId(newGroupProduct.Brand),
		});

		newGroup.save((err, doc) => {
			if (err) {
				return res.status(500).json({
					error: 500,
					message: 'server error',
				});
			}
			return res.json({
				_id: doc._id,
				GroupName: doc.GroupName,
				ProductType: doc.ProductType,
				createdAt: doc.createdAt,
				Brand: doc.Brand,
			});
		});
	} catch (error) {
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
// tr??? l???i b??nh lu???n s???n ph???m
router.post('/api/admin/addReplyComment/:Id_Product', authMiddleware.verifyTokenAdmin, async (req, res) => {
	//add comment : _id propduct _id user, Role.
	const Id_User = res.locals.payload._id;
	const Role = res.locals.payload.Role;
	const Id_Product = req.params.Id_Product;
	const ReplyContent = req.body.ReplyContent;
	const Id_Comment = req.body.Id_Comment;
	if (!ObjectId.isValid(Id_Product) || !ObjectId.isValid(Id_Comment)) {
		return res.status(400).json({
			error: 400,
			message: 'Kh??ng t??m th???y s???n ph???m',
		});
	}

	const newReply = {
		_id: ObjectId(),
		Id_User: Id_User,
		Role: Role,
		ReplyContent: ReplyContent,
	};
	// https://stackoverflow.com/questions/49095532/how-yo-use-arrayfilters-with-mongoose-5-x-x
	//https://jira.mongodb.org/browse/SERVER-831
	GroupProduct.findOneAndUpdate(
		{
			'Product._id': Id_Product,
			'Product.Comment._id': Id_Comment,
		},
		{
			$push: {
				'Product.$[idproduct].Comment.$[idcomment].Reply': newReply,
			},
		},
		{
			arrayFilters: [{ 'idproduct._id': ObjectId(Id_Product) }, { 'idcomment._id': ObjectId(Id_Comment) }],
			upsert: true,
			new: true,
		},
		function (err, doc) {
			if (err) {
				return res.status(500).json({
					error: 500,
					message: 'Kh??ng t???n t???i trong c?? s??? d??? li???u',
				});
			}

			return res.json({
				...newReply,
				ReplyTime: 'V???a xong',
			});
		}
	).lean();
});
router.post('/api/admin/editGroupProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const { Id_GroupProduct } = req.body;
		if (!ObjectId.isValid(Id_GroupProduct)) {
			return res.status(400).json({
				error: 400,
				message: 'Id kh??ng ch??nh x??c',
			});
		}

		const newUpdate = {
			GroupName: req.body.GroupName,
			ProductType: req.body.ProductType,
			Brand: req.body.Brand,
			Describe: req.body.Describe,
		};
		const { error } = await HelperValidate.groupProduct(newUpdate);
		if (error) {
			return res.status(400).json({
				error: 400,
				message: 'Vui l??ng ki???m tra l???i th??ng tin!',
			});
		}

		const update = await GroupProduct.findByIdAndUpdate(Id_GroupProduct, newUpdate, {
			safe: true,
			upsert: true,
			new: true,
		}).select({
			_id: 1,
		});
		return res.status(200).json(update);
	} catch (err) {
		return res.status(500).json({ error: 500, message: 'server error' });
	}
});
router.post('/api/admin/uploadImage', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		await uploadImage(req, res);
		const fileImage = req?.file?.path;

		if (!fileImage) {
			return res.status(400).json({ message: 'image not found' });
		}

		const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);

		if (checkMagicNumbersImage(bitmap) === false) {
			fs.unlink(fileImage, () => {
				// if (er) {
				// 	throw er;
				// }
			});
			return res.status(400).json({
				error: 400,
				message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
			});
		}
		return res.json({ url: '/backend/images/' + req.file.filename });
	} catch (error) {
		console.log(error);

		if (error.message === 'Ch???p nh???n ?????nh d???ng .png  .jpg .jpeg') {
			return res.status(400).json({ message: error.message });
		}
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
/// edit avatar admin
router.post('/api/admin/uploadAvatarAdmin', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		await uploadAvatarAdmin(req, res);
		const fileImage = req?.file?.path;
		if (!fileImage) {
			return res.status(400).json({ message: 'image not found' });
		}
		const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);

		if (checkMagicNumbersImage(bitmap) === false) {
			fs.unlink(fileImage, () => {
				// if (er) {
				// 	throw er;
				// }
			});
			return res.status(400).json({
				error: 400,
				message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
			});
		}
		const newFileName = 'avatar_admin_' + path.basename(req.file.path);
		const newPathName = '/backend/admin/' + newFileName;

		// c???p nh???p trong c?? s??? d??? li???u
		const oldUpdate = await Admin.findByIdAndUpdate(res.locals.payload._id, { Avatar: newPathName }).lean();
		// x??a file c?? trong thu m???c
		fs.unlink(path.join('public' + oldUpdate.Avatar), () => {});
		// ?????i t??n file m???i
		fs.rename(fileImage, path.join('public' + newPathName), err => {
			if (err) {
				return res.status(500).json({ error: 'server error' });
			}
			return res.json({ url: newPathName });
		});
	} catch (error) {
		console.log('eror', error);
		if (error.message === 'Ch???p nh???n ?????nh d???ng .png  .jpg .jpeg') {
			console.log('file sai');

			return res.status(400).json({ message: error.message });
		}
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
// x??at to??n b??? tin nh???n tr?? chuy???n c???a 1 ng?????i
router.post('/api/admin/deleteMessageUser', authMiddleware.verifyTokenAdmin, async (req, res) => {
	const Id_User = req.body.Id_User;
	if (!ObjectId.isValid(Id_User)) {
		return res.status(400).json({ message: '?????u v??o kh??ng h???p l???' });
	}
	try {
		const deleteMessageResult = await User.findByIdAndUpdate(Id_User, { Message: [] }).lean();
		if (deleteMessageResult) {
			return res.json({ message: 'X??a th??nh c??ng' });
		}
		return res.status(400).json({ message: 'Kh??ng t??m th???y user' });
	} catch (error) {
		return res.status(500).json({ message: 'serve l???i' });
	}
});
// ch???nh s???a t??n
router.post('/api/admin/edit-name-admin', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const newName = req.body?.DisplayName?.trim() || '';
		if (newName === '') {
			return res.status(400).json({ message: 'T??n kh??ng h???p l???' });
		}
		await Admin.findByIdAndUpdate(res.locals.payload._id, { DisplayName: newName });
		return res.json({ DisplayName: newName });
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});
// ch???nh s???a m???t kh???u
router.post('/api/admin/edit-password', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const oldPassword = req.body.oldPassword || '';
		const newPassword = req.body.newPassword || '';
		if (oldPassword?.length < 8 || newPassword.length < 8) {
			return res.status(400).json({ message: 'M???t kh???u ph???i 8 k?? t???' });
		}
		const admin = await Admin.findById(res.locals.payload._id).select({ Password: 1 });
		if (!admin) {
			return res.status(400).json({
				message: 'Kh??ng t??m th???y user',
			});
		}
		const checkIsValidOldPassword = await hashPassOrCheck.check(oldPassword, admin.Password);
		if (!checkIsValidOldPassword) return res.status(400).json({ message: 'M???t kh???u c?? kh??ng ????ng' });
		admin.Password = await hashPassOrCheck.hash(newPassword);
		await admin.save();
		return res.json({ message: '?????i m???t kh???u th??nh c??ng' });
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});
router.post('/api/admin/deleteGroupProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_GroupProduct = req.body.Id_GroupProduct;
		if (!ObjectId.isValid(Id_GroupProduct)) {
			return res.status(400).json({ message: 'Th??ng tin ?????u v??o ch??a ch??nh x??c!' });
		}
		const deleteGroupProduct = await GroupProduct.findByIdAndDelete(Id_GroupProduct);
		if (deleteGroupProduct) {
			return res.status(200).json({ Id_GroupProduct: deleteGroupProduct._id });
		}
		return res.status(400).json({ message: 'Kh??ng t??m th???y nh??m s???n ph???m' });
	} catch (error) {
		res.status(500).json({ message: 'server error' });
	}
});

router.post('/api/admin/delete-image', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const { srcImage } = req.body;
		if (!srcImage) return res.status(400).json({ message: 'Thi???u image' });

		const pathImage = path.join(__dirname, '../../public' + srcImage);
		if (fs.existsSync(pathImage)) {
			fs.unlink(pathImage, () => {});
			return res.json({ message: 'x??a th??nh c??ng!' });
		}

		return res.status(422).json({ message: 'Kh??ng t??m th???y image' });
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});

router.get('/api/admin/getEditor/:Id_GroupProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const { Id_GroupProduct } = req.params;
		if (!ObjectId.isValid(Id_GroupProduct)) {
			return res.status(400).json({
				error: 400,
				message: 'Id_GroupProduct is not valid',
			});
		}
		const data = await GroupProduct.findById(Id_GroupProduct).select({
			'Describe.deltaOps': 1,
		});
		if (data) {
			return res.json(data);
		}
		return res.status(500).json({ error: 500, message: 'Server not found' });
	} catch (error) {
		return res.status(500).json({ error: 500, message: 'Server error' });
	}
});
// xem s???n ph???m kh??ch h??ng ???? mua
router.get('/api/admin/product/product-sold', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const query = req.query.query || '^';
		const queryFormat = formatQuery(query);
		const page = get_params_or_query_limit(req.query.page);
		const limit = get_params_or_query_limit(req.query.limit);
		const skip = (page - 1) * limit;

		const data = await User.aggregate([
			{
				$match: {
					'ShoppingHistory.Name': {
						$regex: `${queryFormat}`,
						$options: 'i',
					},
				},
			},
			{ $unwind: '$ShoppingHistory' },
			{
				$sort: {
					'ShoppingHistory.Time': -1,
				},
			},

			{
				$facet: {
					data: [
						{ $skip: skip },
						{
							$limit: limit,
						},
						{
							$project: {
								ShoppingHistory: 1,
							},
						},
					],
					metaData: [
						{
							$group: {
								_id: null,
								total: { $sum: 1 },
							},
						},
						{
							$addFields: {
								limit,
								skip,
								page,
							},
						},
						{
							$project: {
								_id: 0,
								total: 1,
								limit: 1,
								skip: 1,
								page: 1,
							},
						},
					],
				},
			},
		]);
		return res.json(data);
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});
// -------------------------qu???n l?? s???n ph???m
const getSortProduct = sort => {
	if (sort == 'AZ') {
		return { 'Product.ProductName': 1 };
	}
	if (sort == 'ZA') {
		return { 'Product.ProductName': -1 };
	}
	if (sort == 'createdUp') {
		return { 'Product.createdAt': 1 };
	}
	if (sort == 'createdUp') {
		return { 'Product.createdAt': -1 };
	}
	// default
	return {
		'Product.createdAt': -1,
	};
};
const getProducts = async (res, query, page, limit, skip, sort) => {
	try {
		const queryFormat = formatQuery(query);
		const data = await GroupProduct.aggregate([
			{
				$lookup: {
					from: 'brands',
					localField: 'Brand',
					foreignField: '_id',
					as: 'brands',
				},
			},
			{ $unwind: '$Product' },
			{
				$match: {
					'Product.ProductName': {
						$regex: `${queryFormat}`,
						$options: 'i',
					},
				},
			},
			{ $sort: sort },
			{
				$facet: {
					data: [
						{ $skip: skip },

						{ $limit: limit },
						{
							$project: {
								_id: 1,
								GroupName: '$GroupName',
								ProductType: '$ProductType',
								Brand: {
									Id_Brand: '$Brand',
									BrandName: {
										$first: '$brands.BrandName',
									},
									BrandImage: {
										$first: '$brands.BrandImage',
									},
								},
								createdAt: '$Product.createdAt',
								ProductName: '$Product.ProductName',
								Path: '$Product.Path',
								Information: '$Product.Information',
								Image: '$Product.Image',
								Id_Product: '$Product._id',
								CountEvaluate: { $size: '$Product.Evaluate' },
								CountComment: { $size: '$Product.Comment' },
								Views: '$Product.Views',
								ProductSold: '$Product.ProductSold',
								Star: { $avg: '$Product.Evaluate.Star' },
							},
						},
					],
					metaData: [
						{
							$group: {
								_id: null,
								total: { $sum: 1 },
							},
						},
						{
							$addFields: {
								limit,
								skip,
								page,
							},
						},
						{
							$project: {
								_id: 0,
								total: 1,
								limit: 1,
								skip: 1,
								page: 1,
							},
						},
					],
				},
			},
		]);
		res.status(200).json(data[0]);
	} catch (error) {
		console.log(error);

		res.status(500).json({ error: 500, message: 'server error' });
	}
};

router.get('/api/admin/getProducts', async (req, res) => {
	try {
		const query = req.query.query || '^';
		const page = get_params_or_query_limit(req.query.page);
		const limit = get_params_or_query_limit(req.query.limit);
		const skip = (page - 1) * limit;
		const sort = getSortProduct(req.query.sort);
		getProducts(res, query, page, limit, skip, sort);
	} catch (error) {}
});

// th??m s???n ph???m
router.post('/api/admin/addProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_GroupProduct = req.headers['idgroupproduct'] || '';
		let ProductName = req.headers['productname'] || '';
		ProductName = decodeURIComponent(ProductName);
		if (typeof ProductName !== 'string' || ProductName.length < 3) {
			return res.status(400).json({ message: 'T??n ph???i l???n h??n ho???c b???ng 3 k?? t???' });
		}
		if (!ObjectId.isValid(Id_GroupProduct)) return res.status(400).json({ message: 'Ch??a ch???n nh??m s???n ph???m' });
		// ki???m tra xem t??n s???n ph???m ???? t???n t???i ch??a
		const checkExits = await GroupProduct.findOne({ 'Product.ProductName': ProductName }).lean();
		if (checkExits) return res.status(400).json({ message: 'T??n s???n ph???m ???? t???n t???i vui l??ng ?????i t??n kh??c' });
		const groupProduct = await GroupProduct.findById(Id_GroupProduct).select({
			ProductType: 1,
			Product: 1,
		});
		if (!groupProduct) return res.status(400).json({ message: 'Kh??ng t??m th???y nh??m s???n ph???m' });
		const ProductPath = FormatUrlToEn(ProductName);
		await uploadImageCreateProductMiddleware(req, res, {
			typeProduct: groupProduct.ProductType,

			fileName: ProductPath,
		});
		const displayImage = req.files['DisplayImage']?.[0];
		const listImage = req.files['Image'];
		if (!displayImage) {
			return res.status(400).json({ message: 'Ch??a ch???n h??nh ???nh hi???n th??? cho s???n ph???m' });
		}
		if (!Array.isArray(listImage)) {
			return res.status(400).json({ message: 'Ch??a ch???n h??nh ???nh cho s???n ph???m' });
		}

		const Price = req.body.Price;
		const PriceSale = req.body.PriceSale;
		const RemainingAmount = req.body.RemainingAmount;
		const Configuration = isObject(req.body.Configuration);
		if (!Configuration.check || !Array.isArray(Configuration.data)) {
			return res.status(400).json({ message: 'Th??ng tin c???u h??nh s???n ph???m ch??a ????ng' });
		}
		if (Price < 0) return res.status(400).json({ message: 'Gi??  ph???i l???n h??n ho???c b???ng 0' });
		if (PriceSale < 0) return res.status(400).json({ message: 'Gi?? khuy???n m???i  ph???i l???n h??n ho???c b???ng 0' });
		if (RemainingAmount < 0) {
			return res.status(400).json({ message: 'S??? l?????ng ph???i l???n h??n ho???c b???ng 0' });
		}
		const newProductInsert = {
			_id: ObjectId(),
			ProductName: ProductName,
			Path: ProductPath,
			Information: {
				Configuration: Configuration.data,
				DisplayImage: `/backend/${groupProduct.ProductType}/${displayImage.filename}`,
				Price,
				PriceSale,
				RemainingAmount,
			},
			Image: listImage.map(item => `/backend/${groupProduct.ProductType}/${item.filename}`),
		};

		groupProduct.Product.push(newProductInsert);
		await groupProduct.save();
		// t???o k???t qu??? tr??? v???
		const dataResult = await GroupProduct.aggregate([
			{
				$lookup: {
					from: 'brands',
					localField: 'Brand',
					foreignField: '_id',
					as: 'brands',
				},
			},
			{ $unwind: '$Product' },
			{
				$match: {
					'Product._id': ObjectId(newProductInsert._id),
				},
			},
			{ $limit: 1 },
			{
				$project: {
					_id: 1,
					GroupName: '$GroupName',
					ProductType: '$ProductType',
					Brand: {
						Id_Brand: '$Brand',
						BrandName: {
							$first: '$brands.BrandName',
						},
						BrandImage: {
							$first: '$brands.BrandImage',
						},
					},
					createdAt: '$Product.createdAt',
					ProductName: '$Product.ProductName',
					Path: '$Product.Path',
					Information: '$Product.Information',
					Image: '$Product.Image',
					Id_Product: '$Product._id',
					CountEvaluate: { $size: '$Product.Evaluate' },
					CountComment: { $size: '$Product.Comment' },
					Views: '$Product.Views',
					ProductSold: '$Product.ProductSold',
					Star: { $avg: '$Product.Evaluate.Star' },
				},
			},
		]);
		if (dataResult.length == 0) {
			return res.status(500).json({ message: '???? c?? l???i x???y ra' });
		}

		res.json(dataResult[0]);
	} catch (error) {
		if (error.message === 'Ch???p nh???n ?????nh d???ng .png  .jpg .jpeg')
			return res.status(400).json({ message: error.message });
		return res.status(500).json({
			message: 'server error',
		});
	}
});
//x??a 1 s???n ph???m
router.post('/api/admin/deleteProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_Product = req.body.Id_Product;
		const Id_GroupProduct = req.body.Id_GroupProduct;

		if (!ObjectId.isValid(Id_Product) || !ObjectId.isValid(Id_GroupProduct))
			return res.status(400).json({ message: 'Th??ng tin ch??a ch??nh x??c' });
		await GroupProduct.findOneAndUpdate(
			{
				_id: Id_GroupProduct,
			},
			{
				$pull: {
					Product: {
						_id: Id_Product,
					},
				},
			}
		).lean();
		res.json({ message: 'X??a th??nh c??ng' });
	} catch (error) {
		console.log(error);
		res.status(500).json({ message: 'server error' });
	}
});
// th??y ?????i h??nh ???nh hi???n th??? c???a s???n ph???m
router.post('/api/admin/editDisplayImageProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		// l???y lo???i s???n ph???m
		// v?? m???i s???n ph???m c?? m???i ???????ng d??n kh??c nhau
		const typeProduct = req.headers['typeproduct'] || '';

		const Id_Product = req.headers._id || '';
		if (
			typeProduct == '' ||
			Id_Product == '' ||
			!ObjectId.isValid(Id_Product) ||
			(typeProduct !== 'phone' && typeProduct !== 'tablet')
		) {
			return res.status(400).json({ message: 'Th??ng tin ch??a ch??nh x??c' });
		}

		const product = await GroupProduct.aggregate([
			{ $unwind: '$Product' },
			{ $match: { 'Product._id': ObjectId(Id_Product) } },
			{
				$project: {
					Path: '$Product.Path',
					DisplayImage: '$Product.Information.DisplayImage',
				},
			},
		]);
		if (product.length == 0) {
			return res.status(400).json({ message: 'Kh??ng t??m th???y s???n ph???m' });
		}
		// id nh??m s???n ph???m ????? update
		const Id_GroupProduct = product[0]._id;
		// ???????ng danx c?? c???a s???n ph???m
		const oldPathImage = product[0].DisplayImage;
		// t??n m???i b???ng path c???a s???n ph???m +uuid;
		const newFileNameDisplayImage = `${product[0].Path}-${uuid()}`;

		await uploadDisplayImageProduct(req, res, {
			typeProduct: typeProduct,
			pathSaveImage: `public/backend/${typeProduct}`,
			fileName: newFileNameDisplayImage,
			nameRequestBodyOfImage: 'image',
		});
		const fileImage = req?.file?.path;

		if (!fileImage) {
			return res.status(400).json({ message: 'image not found' });
		}
		const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);

		if (checkMagicNumbersImage(bitmap) === false) {
			fs.unlink(fileImage, () => {
				// if (er) {
				// 	throw er;
				// }
			});
			return res.status(400).json({
				error: 400,
				message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
			});
		}

		const newImageUrl = `/backend/${typeProduct}/${req?.file?.filename}`;

		// c???p nh???p trong c?? s??? d??? li???u
		// const oldUpdate = await GroupProduct.findOneAndUpdate(res.locals.payload._id, { Avatar: newPathName }).lean();
		await GroupProduct.findOneAndUpdate(
			{
				'Product._id': Id_Product,
			},
			{
				$set: {
					'Product.$[idproduct].Information.DisplayImage': newImageUrl,
				},
			},
			{
				arrayFilters: [{ 'idproduct._id': ObjectId(Id_Product) }],
				// upsert: true,
				// new: true,
			}
		).lean();

		// x??a file c?? trong thu m???c
		fs.unlinkSync(path.join('public' + oldPathImage), err => {});
		res.json({
			message: 'L??u th??nh c??ng',
			newImageUrl,
		});
	} catch (error) {
		if (error.message === 'Ch???p nh???n ?????nh d???ng .png  .jpg .jpeg') {
			console.log('file sai');

			return res.status(400).json({ message: error.message });
		}
		console.log(error);
		res.status(500).json({ error: 500, message: 'server error' });
	}
});
// thay ?????i th??ng tin s???n ph???m
router.post('/api/admin/editInformationProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_Product = req.body.Id_Product;
		const ProductName = req.body.ProductName;
		const Price = parseInt(req.body.Price) || 0;
		const PriceSale = parseInt(req.body.PriceSale) || 0;

		const RemainingAmount = parseInt(req.body.RemainingAmount) || 0;
		if (!ObjectId.isValid(Id_Product) || typeof ProductName !== 'string') {
			return res.status(400).json({
				message: '?????u v??o kh??ng ????ng',
			});
		}
		// c???p nh???t l???i path cho s???n ph???m v?? path = t??n
		const ProductPath = FormatUrlToEn(ProductName);
		const newUpdate = await GroupProduct.findOneAndUpdate(
			{
				'Product._id': Id_Product,
			},
			{
				$set: {
					'Product.$[idproduct].ProductName': ProductName,
					'Product.$[idproduct].Path': ProductPath,

					'Product.$[idproduct].Information.Price': Price,
					'Product.$[idproduct].Information.PriceSale': PriceSale,
					'Product.$[idproduct].Information.RemainingAmount': RemainingAmount,
				},
			},
			{
				arrayFilters: [{ 'idproduct._id': ObjectId(Id_Product) }],
				upsert: true,
				new: true,
			}
		).lean();

		res.json({
			newUpdate,
			Id_Product,
			ProductName,
			Price,
			PriceSale,
			message: 'L??u th??nh c??ng',
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: 'server error' });
	}
});
//thay ?????i c???u h??nh s???n ph???m
router.post('/api/admin/editConfiguration', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const newConfig = req.body;
		const Id_Product = req.headers._id;

		if (!Array.isArray(newConfig) || !ObjectId.isValid(Id_Product)) {
			return res.status(400).json({ message: '?????u v??o ch??a ????ng' });
		}
		await GroupProduct.findOneAndUpdate(
			{
				'Product._id': Id_Product,
			},
			{
				$set: {
					'Product.$[idproduct].Information.Configuration': newConfig,
				},
			},
			{
				arrayFilters: [{ 'idproduct._id': ObjectId(Id_Product) }],
				upsert: true,
				new: true,
			}
		).lean();
		return res.json({ message: 'L??u th??nh c???ng' });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: 'server error' });
	}
});
// l???y danh s??ch nh??m s???n ph???m ????? thay ?????i s???n ph???m
router.get('/api/admin/getGroupProductOption', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const data = await GroupProduct.find({}).select({
			GroupName: 1,
			_id: 1,
		});
		return res.json(data);
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});
// x??a m???t h??nh ???nh cho danh s??ch h??nh ???nh
router.post('/api/admin/deleteOneImageProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_Product = req.body.Id_Product;
		const Id_GroupProduct = req.body.Id_GroupProduct;

		const urlImage = req.body.urlImage || '';
		if (!ObjectId.isValid(Id_Product) || !ObjectId.isValid(Id_GroupProduct))
			return res.status(400).json({ message: 'Th??ng tin ch??a ch??nh x??c' });
		await GroupProduct.findOneAndUpdate(
			{
				_id: Id_GroupProduct,
			},
			{
				$pull: {
					'Product.$[idproduct].Image': urlImage,
				},
			},
			{
				arrayFilters: [{ 'idproduct._id': ObjectId(Id_Product) }],
			}
		).lean();
		const pathBrandImage = path.join(__dirname, '../../public' + urlImage);
		fs.unlinkSync(pathBrandImage, err => {
			if (!err) console.log('X??a th??nh c??ng ???nh');
		});
		res.json({ message: 'X??a th??nh c??ng' });
	} catch (error) {
		res.status(500).json({ message: 'server error' });
	}
});
// th??m m???t h??nh ???nh cho danh s??ch h??nh ???nh
router.post('/api/admin/addImageProduct', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		const Id_Product = req.headers['idproduct'];
		const Id_GroupProduct = req.headers['idgroupproduct'];
		const typeProduct = req.headers['typeproduct'];

		if (!ObjectId.isValid(Id_Product) || !ObjectId.isValid(Id_GroupProduct))
			return res.status(400).json({ message: 'Th??ng tin ch??a ch??nh x??c' });
		const product = await GroupProduct.aggregate([
			{ $unwind: '$Product' },
			{ $match: { 'Product._id': ObjectId(Id_Product) } },
			{
				$project: {
					Path: '$Product.Path',
				},
			},
		]);
		if (product.length == 0) {
			return res.status(400).json({ message: 'Kh??ng t??m th???y s???n ph???m' });
		}
		// t??n m???i b???ng path c???a s???n ph???m +uuid;
		const newFileNameDisplayImage = `${product[0].Path}-${uuid()}`;
		await uploadDisplayImageProduct(req, res, {
			typeProduct: typeProduct,
			pathSaveImage: `public/backend/${typeProduct}`,
			fileName: newFileNameDisplayImage,
			nameRequestBodyOfImage: 'image',
		});
		const fileImage = req?.file?.path;

		if (!fileImage) {
			return res.status(400).json({ message: 'image not found' });
		}
		const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);

		if (checkMagicNumbersImage(bitmap) === false) {
			fs.unlink(fileImage, () => {
				// if (er) {
				// 	throw er;
				// }
			});
			return res.status(400).json({
				error: 400,
				message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
			});
		}

		const newImageUrl = `/backend/${typeProduct}/${req?.file?.filename}`;
		await GroupProduct.findOneAndUpdate(
			{
				'Product._id': Id_Product,
			},
			{
				$push: {
					'Product.$[idproduct].Image': newImageUrl,
				},
			},
			{
				arrayFilters: [{ 'idproduct._id': ObjectId(Id_Product) }],
			}
		).lean();
		return res.json({
			message: 'Th??m ???nh th??nh c??ng',
			newImageUrl,
		});
	} catch (error) {
		res.status(500).json({ message: 'server error' });
	}
});
//--------------------------------------------------------------- qu???n l?? b??nh lu???n
const findProductComment = async (res, query, page, limit, skip) => {
	try {
		const queryFormat = formatQuery(query);
		const result = await GroupProduct.aggregate([
			// t??? kh??a t??m ki???m "reverse unwind mongodb"
			// $unwind chia t??ch m???ng Sanpham . trong $facet ti???p t???c d??ng uwind chia t??ch m???ng
			{ $unwind: '$Product' },
			// {
			// 	$match: {
			// 		'Product.Path': product_path,
			// 	},
			// },
			{ $unwind: '$Product.Comment' }, //ph???i uwin t???ng c??i ko th??? m???t l??c
			{
				$match: {
					'Product.Comment.CommentContent': {
						$regex: `${queryFormat}`,
						$options: 'i',
					},
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'Product.Comment.Id_User',
					foreignField: '_id',
					as: 'users',
				},
			},
			{
				$lookup: {
					from: 'admins',
					localField: 'Product.Comment.Id_User',
					foreignField: '_id',
					as: 'admins',
				},
			},
			// {
			// 	$addFields: {
			// 		Role: {
			// 			$cond: { if: { $eq: ["$Product.Comment.Role", "admin"] }, then: "admin", else: "user" }, //them m???t field ????? ki???m tra kh???i ph???i t??nh l???i
			// 		},
			// 	},
			// },

			{
				$facet: {
					Comment: [
						{
							$project: {
								_id: 0,
								Id_Comment: '$Product.Comment._id',
								Id_Product: '$Product._id',
								ProductName: '$Product.ProductName',
								ProductPath: '$Product.Path',

								Id_User: '$Product.Comment.Id_User',
								Name: {
									$cond: {
										if: {
											$eq: ['$Product.Comment.Role', 'admin'],
										},
										then: '$admins.DisplayName',
										else: '$users.Name',
									}, //if(check == admin th?? ...)
								},
								Avatar: {
									$cond: {
										if: {
											$eq: ['$Product.Comment.Role', 'admin'],
										},
										then: '$admins.Avatar',
										else: '$users.Avatar',
									},
								},
								CommentContent: '$Product.Comment.CommentContent',
								Reply: '$Product.Comment.Reply',
								Role: '$Product.Comment.Role',
								Time: '$Product.Comment.Time',
							},
						},
						{
							$sort: {
								Time: -1,
							},
						},
						{ $skip: skip },
						{ $limit: limit },
						{
							$set: {
								ReplyIsEmpty: {
									$cond: {
										if: {
											$eq: ['$Reply', []],
										},
										then: true,
										else: false,
									},
								},
							},
						},
						{
							$unwind: {
								path: '$Reply',
								preserveNullAndEmptyArrays: true,
							},
						},
						{
							$lookup: {
								from: 'users',
								localField: 'Reply.Id_User',
								foreignField: '_id',
								as: 'users',
							},
						},
						{
							$lookup: {
								from: 'admins',
								localField: 'Reply.Id_User',
								foreignField: '_id',
								as: 'admins',
							},
						},
						{
							$set: {
								'Reply.Name': {
									$cond: {
										if: {
											$eq: ['$Reply.Role', 'admin'],
										},
										then: '$admins.DisplayName',
										else: '$users.Name',
									}, //if(check == admin th?? ...)
								},
							},
						},
						{
							$set: {
								'Reply.Avatar': {
									$cond: {
										if: {
											$eq: ['$Reply.Role', 'admin'],
										},
										then: '$admins.Avatar',
										else: '$users.Avatar',
									}, //if(check == admin th?? ...)
								},
							},
						},

						{
							$project: {
								_id: 0,
								Id_Comment: 1,
								Id_Product: 1,
								ProductName: 1,
								ProductPath: 1,
								Id_Reply: 1,
								Id_User: 1,
								Name: 1,
								Avatar: 1,
								CommentContent: 1,
								Time: 1,
								Reply: 1,
								Role: 1,
								ReplyIsEmpty: 1,
							},
						},
						{
							$group: {
								_id: '$Id_Comment',
								Id_Product: { $first: '$Id_Product' },
								ProductName: { $first: '$ProductName' },
								ProductPath: { $first: '$ProductPath' },

								Avatar: { $first: '$Avatar' },
								Id_User: { $first: '$Id_User' },
								Role: { $first: '$Role' },
								Name: { $first: '$Name' },
								Time: { $first: '$Time' },
								ReplyIsEmpty: {
									$first: '$ReplyIsEmpty',
								},
								CommentContent: {
									$first: '$CommentContent',
								},
								Reply: { $push: '$Reply' },
							},
						},
					],
					MetaData: [
						//v?? ??? tr??n chia $unwind SanPham.comment n??n ??? d?????i s??? l???y ??c
						//1 thay v?? t???t c??? SanPham.comment trong NHomSanPham
						{
							$group: {
								_id: null,
								CountComment: { $sum: 1 },
							},
						},
						{
							$addFields: {
								Limit: limit,
								Skip: skip,
								Page: page,
							},
						},
						{
							$project: {
								_id: 0, //id NhomSanPham
								CountComment: 1,
								Limit: 1, //hi???n th??? limit ??? tr??n
								Skip: 1,
								Page: 1,
								// Page:page,
								totalPage: {
									// l??m tr??n
									//n???u nhi???u ph??p t??nh h??n :
									//https://stackoverflow.com/questions/55606675/how-to-divide-two-numbers-and-get-the-result-in-whole-numbers-mongodb
									$ceil: {
										$divide: ['$CountComment', '$Limit'],
									},
								},
							},
						},
					],
				},
			},
		]);
		return res.status(200).json(result);
	} catch (error) {
		console.log(error);
		return res.status(500).json({
			error: 'server error',
		});
	}
};
router.get('/api/admin/getComment', async (req, res) => {
	try {
		const query = req.query.query || '^';
		const page = get_params_or_query_limit(req.query.page);
		const limit = get_params_or_query_limit(req.query.limit);
		const skip = (page - 1) * limit;

		findProductComment(res, query, page, limit, skip);
	} catch (error) {}
});

/// ------------------------------------------------------------ qu???n l?? b??i vi???t
// nh??c t???o file kh??c qu?? n??n t???o ??? ????y lu??n
// l???y b??i vi???t chi ti???t - kh??ng c???n ????ng nh???p - cho ng?????i d??ng
router.get('/api/getDetailsPost/:postId', async (req, res) => {
	try {
		const postId = req.params.postId;
		if (!ObjectId.isValid(postId)) return res.status(400).json({ message: '?????u v??o kh??ng  ????ng' });
		const post = await Post.findById(postId);
		if (!post) return res.status(400).json({ message: 'Kh??ng t??m th???y b??i vi???t' });
		return res.json(post);
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});
// l???y post kh??ng c???n ????ng nh???p
router.get('/api/getPost', async (req, res) => {
	const query = req.query.query || '^';
	const page = get_params_or_query_limit(req.query.page);
	const limit = get_params_or_query_limit(req.query.limit);
	const skip = (page - 1) * limit;
	//get post
	try {
		const queryFormat = formatQuery(query);
		const data = await Post.aggregate([
			{
				$match: {
					Title: {
						$regex: `${queryFormat}`,
						$options: 'i',
					},
				},
			},
			{
				$sort: {
					createdAt: -1,
				},
			},

			{
				$facet: {
					data: [
						{ $skip: skip },
						{ $limit: limit },
						{
							$project: {
								Title: 1,
								Content: 1,
								ThumbImage: 1,
								createdAt: 1,
							},
						},
					],
					metaData: [
						{
							$group: {
								_id: null,
								total: { $sum: 1 },
							},
						},
						{
							$addFields: {
								limit,
								skip,
								page,
							},
						},
						{
							$project: {
								_id: 0,
								total: 1,
								limit: 1,
								skip: 1,
								page: 1,
							},
						},
					],
				},
			},
		]);
		return res.json(data);
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: 'server error' });
	}
});
//t???o b??i vi???t
router.post('/api/admin/createPost', authMiddleware.verifyTokenAdmin, async (req, res) => {
	try {
		await uploadPost(req, res);
		const fileImage = req?.file?.path;
		if (!fileImage) {
			return res.status(400).json({ message: 'image not found' });
		}
		const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);

		if (checkMagicNumbersImage(bitmap) === false) {
			fs.unlink(fileImage, () => {
				// if (er) {
				// 	throw er;
				// }
			});
			return res.status(400).json({
				error: 400,
				message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
			});
		}
		const Title = req.body.Title;
		const Content = JSON.parse(req.body?.Content || {});

		if (Title?.trim()?.length === 0) return res.status(400).json({ message: 'T??n b??i vi???t kh??ng h???p l???' });
		if (typeof Content.html !== 'string' || typeof Content.deltaOps !== 'object')
			return res.status(400).json({ message: 'N???i dung b??i vi???t kh??ng h???p l???', req: req.body.Content });
		const newPost = new Post({
			Title,
			Content: {
				html: Content.html,
				deltaOps: Content.deltaOps,
			},
			ThumbImage: '/backend/post/' + req.file.filename,
		});
		newPost.save(err => {
			if (err) {
				return res.status(500).json({ message: 'Server error' });
			}
			return res.json(newPost);
		});
	} catch (error) {
		return res.status(500).json({ message: 'Server error' });
	}
});
// chinhr s???a b??i vi???t
router.post('/api/admin/editPost', authMiddleware.verifyTokenAdmin, async (req, res) => {
	const isEditImage =
		req.headers['edit-image'] === 'true' || req.headers['edit-image'] == 'false'
			? req.headers['edit-image']
			: 'false';

	let Title;
	let Content;
	let fileImage;

	try {
		if (isEditImage === 'true') {
			await uploadPost(req, res);
			fileImage = req?.file?.path;
			if (!fileImage) {
				return res.status(400).json({ message: 'image not found' });
			}
			const bitmap = fs.readFileSync(fileImage).toString('hex', 0, 4);

			if (checkMagicNumbersImage(bitmap) === false) {
				fs.unlink(fileImage, () => {
					// if (er) {
					// 	throw er;
					// }
				});
				return res.status(400).json({
					error: 400,
					message: 'Ch??? h??? tr??? ?????nh d???ng jpg, png, jpeg!',
				});
			}
		}
		const IdPost = req.body.IdPost;
		if (!ObjectId.isValid(IdPost)) {
			fs.unlink(fileImage, () => {});
			return res.status(400).json({
				message: '?????u v??o kh??ng ????ng',
			});
		}
		Title = req.body.Title;
		Content = typeof req.body?.Content == 'string' ? JSON.parse(req.body?.Content || {}) : req.body?.Content;

		if (Title?.trim()?.length === 0) {
			fs.unlink(fileImage, () => {});
			return res.status(400).json({ message: 'T??n b??i vi???t kh??ng h???p l???' });
		}
		if (typeof Content.html !== 'string' || typeof Content.deltaOps !== 'object') {
			fs.unlink(fileImage, () => {});
			return res.status(400).json({ message: 'N???i dung b??i vi???t kh??ng h???p l???', req: req.body.Content });
		}
		let updatePostObj;
		let newImageUrl = '';
		if (isEditImage === 'true') {
			newImageUrl = '/backend/post/' + req.file.filename;
			updatePostObj = {
				Title: Title,
				Content: Content,
				ThumbImage: newImageUrl,
			};
		} else {
			updatePostObj = {
				Title: Title,
				Content: Content,
			};
		}
		const updatePost = await Post.findByIdAndUpdate(IdPost, updatePostObj).lean();
		if (!updatePost) {
			return res.status(500).json({ message: 'server error' });
		}
		// x??a ???nh c??
		if (isEditImage === 'true') {
			const oldUrlImageThumb = path.join(process.cwd(), `/public${updatePost.ThumbImage}`);
			await fs.unlink(oldUrlImageThumb, err => {
				if (!err) console.log('D?? x??a ha');
			});
		}
		res.json({ message: 'C???p nh???t b??i vi???t th??nh c??ng', newImageUrl });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: 'server error' });
	}
});
//x??a b??i vi???t
router.post('/api/admin/deletePost', authMiddleware.verifyTokenAdmin, async (req, res) => {
	const Id_Post = req.body._id;
	try {
		if (!ObjectId.isValid(Id_Post)) return res.status(400).json({ message: 'Y??u c???u kh??ng h???p l???' });
		const post = await Post.findByIdAndDelete(Id_Post).lean();
		if (post) {
			return res.json({ message: 'X??a th??nh c??ng' });
		}
		return res.json({ message: 'Kh??ng t??m th???y b??i vi???t' });
	} catch (error) {
		return res.status(500).json({ message: 'server error' });
	}
});

module.exports = router;
