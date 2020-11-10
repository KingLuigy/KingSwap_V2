const KingToken = artifacts.require('KingToken');
const AddressStringUtil = artifacts.require('AddressStringUtilWrapper');

contract('AddressStringUtil', () => {
    beforeEach(async () => {
        this.king = await KingToken.new();
        this.util = await AddressStringUtil.new();
    });

    it('should properly covert address to the uppercase hex string', async () => {
        let len = 6;
        assert.equal((await this.util.toAsciiString(this.king.address, len)).valueOf(), this.king.address.slice(2,).slice(0,len).toUpperCase());
        len = 20;
        assert.equal((await this.util.toAsciiString(this.king.address, len)).toString(), this.king.address.slice(2,).slice(0,len).toUpperCase());
    });
})