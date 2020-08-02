'use strict'

const { FFError } = require('./error')

module.exports.validatePaginationOpts = function (options = {}) {
  let { page, size } = options.pagination ? options.pagination : {}

  if (page && size) {
    if (isNaN(page) || isNaN(size)) {
      throw new FFError(
        'InvalidOptions',
        'Pagination requires page and size to be numbers',
        'page::validatePaginationOpts',
        options.pagination
      )
    }

    page = Number(page)
    size = Number(size)

    if (page === 0) {
      throw new FFError(
        'InvalidOptions',
        'page is zero -- paginagion begins with page = 1',
        'page::validatePaginationOpts',
        options.pagination
      )
    }

    const start = (page - 1) * size
    const end = page * size

    return { page, size, start, end }
  }

  return 0
}
