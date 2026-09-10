classdef ReduceMeanLayer1020 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net_epoch_07.coder.ReduceMeanLayer1020';
        end
    end


    methods
        function this = ReduceMeanLayer1020(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_5_38'};
        end

        function [x_blocks_blocks_5_38] = predict(this, x_blocks_blocks_5_32)
            if isdlarray(x_blocks_blocks_5_32)
                x_blocks_blocks_5_32 = stripdims(x_blocks_blocks_5_32);
            end
            x_blocks_blocks_5_32NumDims = 4;
            x_blocks_blocks_5_32 = severity_net_epoch_07.ops.permuteInputVar(x_blocks_blocks_5_32, [4 3 1 2], 4);

            [x_blocks_blocks_5_38, x_blocks_blocks_5_38NumDims] = ReduceMeanGraph1060(this, x_blocks_blocks_5_32, x_blocks_blocks_5_32NumDims, false);
            x_blocks_blocks_5_38 = severity_net_epoch_07.ops.permuteOutputVar(x_blocks_blocks_5_38, [3 4 2 1], 4);

            x_blocks_blocks_5_38 = dlarray(single(x_blocks_blocks_5_38), 'SSCB');
        end

        function [x_blocks_blocks_5_38] = forward(this, x_blocks_blocks_5_32)
            if isdlarray(x_blocks_blocks_5_32)
                x_blocks_blocks_5_32 = stripdims(x_blocks_blocks_5_32);
            end
            x_blocks_blocks_5_32NumDims = 4;
            x_blocks_blocks_5_32 = severity_net_epoch_07.ops.permuteInputVar(x_blocks_blocks_5_32, [4 3 1 2], 4);

            [x_blocks_blocks_5_38, x_blocks_blocks_5_38NumDims] = ReduceMeanGraph1060(this, x_blocks_blocks_5_32, x_blocks_blocks_5_32NumDims, true);
            x_blocks_blocks_5_38 = severity_net_epoch_07.ops.permuteOutputVar(x_blocks_blocks_5_38, [3 4 2 1], 4);

            x_blocks_blocks_5_38 = dlarray(single(x_blocks_blocks_5_38), 'SSCB');
        end

        function [x_blocks_blocks_5_38, x_blocks_blocks_5_38NumDims1062] = ReduceMeanGraph1060(this, x_blocks_blocks_5_32, x_blocks_blocks_5_32NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_07.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1061, x_blocks_blocks_5_32NumDims);
            xMean = mean(x_blocks_blocks_5_32, dims);
            x_blocks_blocks_5_38 = xMean;
            x_blocks_blocks_5_38NumDims = x_blocks_blocks_5_32NumDims;

            % Set graph output arguments
            x_blocks_blocks_5_38NumDims1062 = x_blocks_blocks_5_38NumDims;

        end

    end

end